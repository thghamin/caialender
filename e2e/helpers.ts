import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

export const PASSWORD = "e2e-Password-123";

/** 학번은 중복 가입이 막혀 있으므로 테스트 계정마다 겹치지 않는 학번을 만든다 */
export const uniqueStudentNo = () => `20${String(Date.now() % 1e5).padStart(5, "0")}${String(Math.floor(Math.random() * 1e3)).padStart(3, "0")}`;

export async function approveByEmail(email: string) {
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  const id = data.users.find((u) => u.email === email)?.id;
  if (!id) throw new Error(`${email} 계정이 없습니다.`);
  const { error } = await s.from("profiles").update({ approval_status: "approved" }).eq("id", id);
  if (error) throw error;
  return id;
}

/**
 * 회원가입 화면으로 가입한다. 기본으로는 가입 후 승인 처리까지 해서 /my 로 이동한다. (베타 자동 승인이어도 동작)
 * approve: false 면 승인하지 않고 제출 직후 상태 그대로 둔다.
 * 학번이 10자리 숫자면 겹치지 않는 학번으로 바꾼다 (exactStudentNo: true 면 그대로).
 */
export async function signupViaUi(
  page: Page,
  u: { name: string; studentNo: string; grade: number; email: string; passwordConfirm?: string },
  opts: { approve?: boolean; exactStudentNo?: boolean } = {},
) {
  const { approve = true, exactStudentNo = false } = opts;
  const studentNo = !exactStudentNo && /^\d{10}$/.test(u.studentNo) ? uniqueStudentNo() : u.studentNo;
  await page.goto("/signup");
  await page.getByLabel("이름").fill(u.name);
  await page.getByLabel("학번").fill(studentNo);
  await page.getByLabel("이메일").fill(u.email);
  await page.getByLabel("비밀번호 (8자 이상)").fill(PASSWORD);
  await page.getByLabel("비밀번호 확인").fill(u.passwordConfirm ?? PASSWORD);
  await page.getByLabel(/전자공학부 인공지능전공 학생입니다/).check();
  await page.getByLabel("학년").selectOption(String(u.grade));
  await page.getByRole("button", { name: "가입하기" }).click();
  if (!approve) return studentNo;
  // 베타(자동 승인)면 바로 학과 캘린더로, 승인제면 승인 대기 화면으로 간다
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"));
  await approveByEmail(u.email);
  await page.goto("/my");
  return studentNo;
}

export async function loginViaUi(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
}

/** 테스트 중 만든 계정 삭제 */
export async function deleteUsersByPrefix(prefix: string) {
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.startsWith(prefix))) await s.auth.admin.deleteUser(u.id);
}
