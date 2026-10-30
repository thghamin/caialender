import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

const tag = Date.now().toString(36);
const prefix = `e2e1-${tag}`;
const studentEmail = `${prefix}-student@caialender-test.dev`;
const adminEmail = `${prefix}-admin@caialender-test.dev`;

test.describe.configure({ mode: "serial" });
test.afterAll(async () => deleteUsersByPrefix(prefix));

const profileOf = async (email: string) => {
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  const id = data.users.find((u) => u.email === email)!.id;
  return (await s.from("profiles").select("role, approval_status, department, grade").eq("id", id).single()).data;
};

test("비로그인 사용자는 어떤 화면이든 로그인 화면으로 간다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await page.goto("/academic");
  await expect(page).toHaveURL(/\/login\?next=%2Facademic$/);
  const api = await page.request.get("/api/briefing?scope=all");
  expect(api.status()).toBe(401);
});

test("관리자 지정 후 관리자 페이지 접근", async ({ page }) => {
  await signupViaUi(page, { name: "박기획", studentNo: "2025000001", grade: 3, email: adminEmail });
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  await s.from("profiles").update({ role: "admin" }).eq("id", data.users.find((u) => u.email === adminEmail)!.id);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "학생회 관리" })).toBeVisible();
  await expect(page.getByText("학생회 관리자")).toBeVisible();
});

test("회원가입 → 승인 대기(서비스 차단) → 관리자 승인 → 이용", async ({ page, browser }) => {
  await signupViaUi(page, { name: "김새내", studentNo: "2027012345", grade: 1, email: studentEmail }, { approve: false });
  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByRole("heading", { name: "가입 승인을 기다리고 있어요" })).toBeVisible();
  expect(await profileOf(studentEmail)).toEqual({ role: "student", approval_status: "pending", department: "전자공학부 인공지능전공", grade: 1 });

  // 승인 전에는 다른 화면과 API에 접근할 수 없다
  for (const path of ["/", "/my", "/academic", "/qna", "/notices", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/pending$/);
  }
  await expect(page.getByRole("link", { name: "학과 캘린더" })).toHaveCount(0);
  expect((await page.request.get("/api/briefing?scope=all")).status()).toBe(403);

  // 로그아웃 후 다시 로그인해도 안내 화면만
  await page.getByRole("button", { name: "로그아웃" }).first().click();
  await page.waitForURL("**/login"); // 로그아웃이 끝난 뒤 다시 로그인
  await loginViaUi(page, studentEmail);
  await expect(page).toHaveURL(/\/pending$/);

  // 관리자가 회원 관리에서 승인
  const admin = await browser.newPage();
  await loginViaUi(admin, adminEmail);
  await admin.waitForURL("**/my");
  await admin.goto("/admin");
  await admin.getByRole("link", { name: /회원 관리/ }).click();
  // 첫 번째 표가 '가입 승인 대기' 목록
  const row = admin.getByRole("row").filter({ hasText: studentEmail }).first();
  await expect(row.getByText("전자공학부 인공지능전공")).toBeVisible();
  await expect(row.getByText("승인 대기")).toBeVisible();
  await row.getByRole("button", { name: "승인" }).click();
  await expect(admin.getByRole("row").filter({ hasText: studentEmail }).getByText("승인됨")).toBeVisible();
  await admin.close();

  await page.goto("/my");
  await expect(page.getByRole("heading", { name: "내 캘린더" })).toBeVisible();
  await expect(page.getByText("김새내 · 1학년")).toBeVisible();
  // 학생에게는 관리자 메뉴가 없고, 관리자 페이지 접근 시 홈으로 돌려보낸다
  await expect(page.getByRole("link", { name: "관리자" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
});

test("관리자가 거절하면 거절 안내만 보인다", async ({ page, browser }) => {
  const email = `${prefix}-reject@caialender-test.dev`;
  await signupViaUi(page, { name: "거절될", studentNo: "2027000099", grade: 2, email }, { approve: false });
  await expect(page).toHaveURL(/\/pending$/);

  const admin = await browser.newPage();
  await loginViaUi(admin, adminEmail);
  await admin.waitForURL("**/my");
  await admin.goto("/admin/members");
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("row").filter({ hasText: email }).first().getByRole("button", { name: "거절" }).click();
  await expect(admin.getByRole("row").filter({ hasText: email }).first().getByText("거절됨")).toBeVisible();
  await admin.close();

  await page.goto("/my");
  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByRole("heading", { name: "가입이 승인되지 않았어요" })).toBeVisible();
  expect((await profileOf(email))?.approval_status).toBe("rejected");
});

test("잘못된 입력·중복 가입·틀린 비밀번호는 한국어 오류를 보여준다", async ({ page }) => {
  await signupViaUi(page, { name: "오류", studentNo: "123", grade: 2, email: `${prefix}-bad@caialender-test.dev` }, { approve: false });
  // 브라우저 pattern 검증에 걸려 제출되지 않는다
  await expect(page).toHaveURL(/\/signup$/);

  await signupViaUi(
    page,
    { name: "오류", studentNo: "2027000123", grade: 2, email: `${prefix}-bad@caialender-test.dev`, passwordConfirm: "different-password" },
    { approve: false },
  );
  await expect(page.getByText("비밀번호 확인이 일치하지 않습니다.")).toBeVisible();

  // 이미 가입된 이메일
  await signupViaUi(page, { name: "중복", studentNo: "2027000124", grade: 2, email: studentEmail }, { approve: false });
  await expect(page.getByText("이미 가입된 이메일입니다.")).toBeVisible();

  // 이미 가입된 학번
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  const taken = (await s.from("profiles").select("student_no").eq("id", data.users.find((u) => u.email === studentEmail)!.id).single()).data!
    .student_no as string;
  await signupViaUi(page, { name: "중복", studentNo: taken, grade: 2, email: `${prefix}-dup@caialender-test.dev` }, { approve: false, exactStudentNo: true });
  await expect(page.getByText("이미 가입된 학번입니다.")).toBeVisible();
  expect(data.users.some((u) => u.email === `${prefix}-dup@caialender-test.dev`)).toBe(false);

  await page.goto("/login");
  await page.getByLabel("이메일").fill(studentEmail);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
});
