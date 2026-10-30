import { expect, test, type Browser } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

// 학사/학과/내 캘린더 분리, 캘린더에서 바로 담기, 질문 게시판, 총관리자의 관리자 임명
const tag = Date.now().toString(36);
const prefix = `e2e7-${tag}`;
const T = `E2E7-${tag}`;
const email = (k: string) => `${prefix}-${k}@caialender-test.dev`;

function kstDay(offsetDays: number) {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
}

const ids: Record<string, string> = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  // 오늘 날짜가 월말이어도 같은 달 화면에 보이도록 오늘 일정으로 만든다
  const s = service();
  for (const [key, row] of Object.entries({
    academic: { title: `${T} 학사 수강신청`, calendar: "academic", kind: "event", target_grades: [] },
    grad: { title: `${T} 대학원 논문 접수`, calendar: "academic", kind: "event", target_grades: [], target_note: "대학원" },
    dept: { title: `${T} 학과 MT`, calendar: "dept", kind: "event", target_grades: [] },
  })) {
    const { data, error } = await s
      .from("events")
      .insert({ ...row, start_at: kstDay(0), all_day: true, status: "published" })
      .select("id")
      .single();
    if (error) throw error;
    ids[key] = data.id;
  }
  for (const k of ["student", "admin", "super"]) {
    const page = await (browser as Browser).newPage();
    await signupViaUi(page, { name: `테스트${k}`, studentNo: "2027000000", grade: 2, email: email(k) }); // 승인까지 처리
    await page.close();
  }
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.startsWith(prefix))) ids[u.email!.slice(prefix.length + 1).split("@")[0]] = u.id;
  await s.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
  await s.from("profiles").update({ role: "super_admin" }).eq("id", ids.super);
});

test.afterAll(async () => {
  const s = service();
  await s.from("events").delete().like("title", `${T}%`);
  await deleteUsersByPrefix(prefix); // questions는 profiles 삭제와 함께 지워진다
});

test("학사·학과 캘린더는 따로 보이고, 학사일정은 눌러서 담은 것만 내 캘린더에", async ({ page }) => {
  await loginViaUi(page, email("student"));
  await page.waitForURL("**/my");
  // 담기 전: 학과 일정(전체 대상)은 자동, 학사일정은 없음
  await expect(page.getByText(`${T} 학과 MT`).first()).toBeVisible();
  await expect(page.getByText(`${T} 학사 수강신청`)).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "학과 캘린더" })).toBeVisible();
  await expect(page.getByText(`${T} 학과 MT`).first()).toBeVisible();
  await expect(page.getByText(`${T} 학사 수강신청`)).toHaveCount(0);

  await page.goto("/academic");
  await expect(page.getByRole("heading", { name: "학사 캘린더" })).toBeVisible();
  await expect(page.getByText(`${T} 학과 MT`)).toHaveCount(0);
  // 대학원 일정은 체크해야 보인다
  await expect(page.locator(".caialender-calendar").getByText(`${T} 대학원 논문 접수`)).toHaveCount(0);
  await page.getByLabel(/대학원 일정도 보기/).check();
  await expect(page.locator(".caialender-calendar").getByText(`${T} 대학원 논문 접수`).first()).toBeVisible();

  // 캘린더에서 일정을 누르면 팝업에서 바로 담는다
  await page.locator(".caialender-calendar").getByText(`${T} 학사 수강신청`).first().click();
  const dialog = page.getByRole("dialog", { name: `${T} 학사 수강신청` });
  await expect(dialog.getByText("학사 캘린더")).toBeVisible();
  await dialog.getByRole("button", { name: "☆ 내 캘린더에 추가" }).click();
  await expect(dialog.getByRole("button", { name: "★ 내 캘린더에서 빼기" })).toBeVisible();

  await page.goto("/my");
  await expect(page.getByText(`${T} 학사 수강신청`).first()).toBeVisible();
});

test("질문 게시판: 학생이 질문하고 관리자가 답한다", async ({ browser }) => {
  const student = await browser.newPage();
  await loginViaUi(student, email("student"));
  await student.waitForURL("**/my");
  // 일정 상세에서 그 일정에 대해 질문
  await student.goto(`/events/${ids.dept}`);
  await student.getByPlaceholder(/회비는 얼마인가요/).fill(`${T} MT 회비는 얼마인가요?`);
  await student.getByRole("button", { name: "질문 남기기" }).click();
  await expect(student.getByText(`Q. ${T} MT 회비는 얼마인가요?`)).toBeVisible();
  await expect(student.getByText("답변 대기").first()).toBeVisible();
  // 학생에게는 답변 입력칸이 없다
  await expect(student.getByLabel("답변")).toHaveCount(0);

  const admin = await browser.newPage();
  await loginViaUi(admin, email("admin"));
  await admin.waitForURL("**/my");
  await admin.goto("/admin");
  await expect(admin.getByText(/답변을 기다리는 학생 질문 [1-9]/)).toBeVisible();
  await admin.goto("/qna?status=pending");
  const item = admin.getByTestId("question").filter({ hasText: `${T} MT 회비는` });
  await expect(item.getByText("테스트student · 2학년")).toBeVisible(); // 관리자는 질문자 이름을 본다
  await item.getByLabel("답변").fill("1인 3만원이고, 학생회 계좌로 입금하면 됩니다.");
  await item.getByRole("button", { name: "답변 등록" }).click();
  // 답변하면 '답변 대기' 목록에서 빠지고 전체 목록에서 답변 완료로 보인다
  await expect(item).toHaveCount(0);
  await admin.goto("/qna");
  await expect(admin.getByTestId("question").filter({ hasText: `${T} MT 회비는` }).getByText("답변 완료")).toBeVisible();

  await student.reload();
  await expect(student.getByText("1인 3만원이고, 학생회 계좌로 입금하면 됩니다.")).toBeVisible();
  await student.goto("/qna?status=answered");
  await expect(student.getByText(`Q. ${T} MT 회비는 얼마인가요?`)).toBeVisible();
  await student.close();
  await admin.close();
});

test("총관리자만 관리자를 임명하고, 임명된 학생은 관리자 화면에 들어간다", async ({ browser }) => {
  const admin = await browser.newPage();
  await loginViaUi(admin, email("admin"));
  await admin.waitForURL("**/my");
  // 일반 관리자는 회원 관리에 들어오지만 임명 버튼이 없고, 총관리자·관리자 행에는 아무 버튼도 없다
  await admin.goto("/admin/members");
  await expect(admin.getByRole("heading", { name: "👥 회원 관리" })).toBeVisible();
  await expect(admin.getByRole("button", { name: "관리자로 임명" })).toHaveCount(0);
  await expect(admin.getByRole("row").filter({ hasText: email("super") }).getByRole("button")).toHaveCount(0);
  await admin.close();

  const sup = await browser.newPage();
  await loginViaUi(sup, email("super"));
  await sup.waitForURL("**/my");
  await expect(sup.getByText("총관리자").first()).toBeVisible();
  await sup.goto("/admin");
  await sup.getByRole("link", { name: /회원 관리/ }).click();
  await sup.getByPlaceholder("이름, 학번, 이메일로 찾기").fill(email("student"));
  await sup.getByRole("button", { name: "검색" }).click();
  const row = sup.getByRole("row").filter({ hasText: email("student") }).last();
  await row.getByRole("button", { name: "관리자로 임명" }).click();
  await expect(row.getByText("학생회 관리자")).toBeVisible();

  const student = await browser.newPage();
  await loginViaUi(student, email("student"));
  await student.waitForURL("**/my");
  await student.getByRole("link", { name: "관리자" }).click();
  await expect(student.getByRole("heading", { name: "학생회 관리" })).toBeVisible();

  // 해제
  sup.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "관리자 해제" }).click();
  await expect(row.getByText("학생", { exact: true })).toBeVisible();
  await student.goto("/admin");
  await expect(student).not.toHaveURL(/\/admin$/);
  await sup.close();
  await student.close();
});

test("학과 초록·학사 빨강 고정, 나머지는 무지개 중 고른 색으로 사이트 전체가 바뀌고 유지된다", async ({ page }) => {
  await loginViaUi(page, email("student"));
  await page.waitForURL("**/my");
  await page.goto("/");
  await expect(page.getByAltText("경북대학교 전자공학부 로고")).toBeVisible();
  await expect(page.getByText("K:AI", { exact: true })).toBeVisible();

  // 학과 캘린더 화면은 초록 테마
  const brand = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  expect(await brand()).toBe("#15803d");

  await page.goto("/my");
  await page.getByRole("button", { name: "파랑" }).click();
  await expect(page.getByRole("button", { name: "파랑" })).toHaveAttribute("aria-pressed", "true");
  expect(await brand()).toBe("#1d4ed8");
  // 새로고침해도, 다른 화면(질문)에서도 고른 색. 학사 캘린더는 KNU 빨강 고정
  await page.reload();
  expect(await brand()).toBe("#1d4ed8");
  await page.goto("/qna");
  expect(await brand()).toBe("#1d4ed8");
  await page.goto("/academic");
  expect(await brand()).toBe("#c41b22");
  // 선택된 '월' 버튼 글자는 흰색
  await expect(page.getByRole("tab", { name: "월", selected: true })).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("휴대폰: 하단 탭 메뉴로 이동하고, PC 버전 ↔ 모바일 버전을 바꾼다", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await loginViaUi(page, email("student"));
  await page.waitForURL("**/my");
  const tabs = page.getByRole("navigation", { name: "모바일 메뉴" });
  await expect(tabs).toBeVisible();
  // 로그인하면 앱 설치를 권하고, [나중에]를 누르면 다시 묻지 않는다
  const install = page.getByRole("dialog", { name: "앱 설치 안내" });
  await expect(install).toBeVisible();
  await expect(install.getByText("알림을 받을 수 있어요")).toBeVisible();
  await install.getByRole("button", { name: "나중에" }).click();
  await expect(install).toBeHidden();
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(install).toBeHidden();
  await tabs.getByRole("link", { name: /학사/ }).click();
  await expect(page.getByRole("heading", { name: "학사 캘린더" })).toBeVisible();

  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: /PC 버전으로 보기/ }).click()]);
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(1280);
  await expect(tabs).toBeHidden();
  // PC 모드(화면 폭 1280을 휴대폰에 축소해 표시)에서는 Playwright 에뮬레이터의 좌표 계산이 맞지 않아
  // 클릭 이벤트를 직접 보낸다. 실제 휴대폰 터치에는 문제가 없다.
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: /모바일 버전으로 보기/ }).dispatchEvent("click")]);
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
  await expect(tabs).toBeVisible();
  await ctx.close();
});
