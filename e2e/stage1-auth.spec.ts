import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

const tag = Date.now().toString(36);
const prefix = `e2e1-${tag}`;
const studentEmail = `${prefix}-student@caialender-test.dev`;
const adminEmail = `${prefix}-admin@caialender-test.dev`;

test.afterAll(async () => deleteUsersByPrefix(prefix));

test("회원가입 → 내 캘린더 → 로그아웃 → 로그인", async ({ page }) => {
  await signupViaUi(page, { name: "김새내", studentNo: "2027012345", grade: 1, email: studentEmail });
  await expect(page).toHaveURL(/\/my$/);
  await expect(page.getByText("김새내 · 1학년")).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 캘린더" })).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();

  await loginViaUi(page, studentEmail);
  await expect(page).toHaveURL(/\/my$/);
  // 학생에게는 관리자 메뉴가 없고, 관리자 페이지 접근 시 홈으로 돌려보낸다
  await expect(page.getByRole("link", { name: "관리자" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
});

test("잘못된 입력과 비밀번호는 한국어 오류를 보여준다", async ({ page }) => {
  await signupViaUi(page, { name: "오류", studentNo: "123", grade: 2, email: `${prefix}-bad@caialender-test.dev` });
  // 브라우저 pattern 검증에 걸려 제출되지 않거나, 서버가 오류를 돌려준다
  await expect(page).toHaveURL(/\/signup$/);

  await page.goto("/login");
  await page.getByLabel("이메일").fill(studentEmail);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
});

test("기획부 관리자 지정 후 관리자 페이지 접근", async ({ page }) => {
  await signupViaUi(page, { name: "박기획", studentNo: "2025000001", grade: 3, email: adminEmail });
  await expect(page).toHaveURL(/\/my$/);
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  const id = data.users.find((u) => u.email === adminEmail)!.id;
  await s.from("profiles").update({ role: "admin" }).eq("id", id);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "학생회 기획부 관리" })).toBeVisible();
  await expect(page.getByText("박기획 · 3학년 · 기획부")).toBeVisible();
});
