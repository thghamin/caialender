import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

export const PASSWORD = "e2e-Password-123";

export async function signupViaUi(page: Page, u: { name: string; studentNo: string; grade: number; email: string }) {
  await page.goto("/signup");
  await page.getByLabel("이름").fill(u.name);
  await page.getByLabel("학번").fill(u.studentNo);
  await page.getByLabel("학년").selectOption(String(u.grade));
  await page.getByLabel("이메일").fill(u.email);
  await page.getByLabel("비밀번호 (8자 이상)").fill(PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
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
