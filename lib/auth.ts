import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { isAdminRole, type Profile } from "./types";

/** 현재 로그인 사용자와 프로필. 비로그인이면 null */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, student_no, grade, department, role, approval_status")
    .eq("id", user.id)
    .single();
  return (profile as Profile | null) ?? null;
});

/** 로그인만 확인 (승인 대기 안내 화면용) */
export async function requireSignedIn(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 서비스 이용: 로그인 + 관리자 승인 완료. 승인 전이면 안내 화면으로 보낸다 */
export async function requireUser(): Promise<Profile> {
  const user = await requireSignedIn();
  if (user.approval_status !== "approved") redirect("/pending");
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) redirect("/");
  return user;
}

/** 총관리자: 관리자 임명·해제 */
export async function requireSuperAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/");
  return user;
}
