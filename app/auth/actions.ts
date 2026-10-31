"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUTO_APPROVE_SIGNUP } from "@/lib/beta";

/** 이 서비스는 경북대 전자공학부 인공지능전공 전용 */
const DEPARTMENT = "전자공학부 인공지능전공";

export type AuthState = { error?: string; message?: string } | undefined;

const loginSchema = z.object({
  email: z.email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력하세요.").max(30),
    student_no: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "학번은 숫자 10자리입니다."),
    email: z.email("이메일 형식이 올바르지 않습니다."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    password_confirm: z.string(),
    major_confirm: z.literal("on", { error: "전자공학부 인공지능전공 학생만 가입할 수 있어요." }),
    grade: z.coerce.number().int().min(1, "학년을 선택하세요.").max(4),
  })
  .refine((d) => d.password === d.password_confirm, { message: "비밀번호 확인이 일치하지 않습니다.", path: ["password_confirm"] });

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (/already registered|already been registered/i.test(message)) return "이미 가입된 이메일입니다.";
  if (/email not confirmed/i.test(message)) return "이메일 인증이 완료되지 않았습니다. 메일함을 확인하세요.";
  if (/rate limit/i.test(message)) return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
  // 학번 unique 인덱스 위반은 가입 트리거에서 'Database error saving new user'로 나온다
  if (/database error saving new user/i.test(message)) return "이미 가입된 학번입니다.";
  return message;
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/my");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, student_no, grade, email, password } = parsed.data;
  const department = DEPARTMENT;
  const meta = { name, student_no, department, grade };

  // 학번 중복 확인 (DB unique 인덱스가 최종적으로 막고, 여기서는 알기 쉬운 안내를 위해 먼저 확인)
  const { count } = await createServiceClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("student_no", meta.student_no);
  if (count) return { error: "이미 가입된 학번입니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { ...meta, grade: String(meta.grade) } },
  });
  if (error) return { error: translateAuthError(error.message) };

  // 베타 기간: 방금 만든 이 계정만 바로 승인 (권한·역할은 학생 그대로, 다른 회원은 건드리지 않음)
  if (AUTO_APPROVE_SIGNUP && data.user) {
    await createServiceClient().from("profiles").update({ approval_status: "approved" }).eq("id", data.user.id).eq("approval_status", "pending");
  }
  // 이메일 인증이 켜져 있으면 세션 없이 user만 반환됨
  if (!data.session) {
    return {
      message: AUTO_APPROVE_SIGNUP
        ? "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요."
        : "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요. 로그인 후 관리자 승인을 기다려 주세요.",
    };
  }
  revalidatePath("/", "layout");
  // 베타: 바로 학과 캘린더(처음 사용법 안내가 뜬다) / 정식: 승인 대기 안내
  redirect(AUTO_APPROVE_SIGNUP ? "/" : "/pending");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
