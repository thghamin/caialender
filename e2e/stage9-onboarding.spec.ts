import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

// 처음 둘러보기: 화면 요소를 하나씩 비추며 소개, 그만 보기·✕·시작하기로 끝내면 다시 안 뜬다
const prefix = `e2e9-${Date.now().toString(36)}`;
test.afterAll(async () => deleteUsersByPrefix(prefix));

for (const [name, viewport] of [["휴대폰", { width: 390, height: 844 }], ["PC", { width: 1280, height: 900 }]] as const) {
  test(`둘러보기 (${name}): 단계별로 소개하고, 끝내면 다시 뜨지 않는다`, async ({ browser }) => {
    const page = await browser.newPage({ viewport });
    await signupViaUi(page, { name: "둘러보기", studentNo: "2027000000", grade: 1, email: `${prefix}-${name === "PC" ? "pc" : "m"}@caialender-test.dev` });
    // 자동화 브라우저에서는 자동으로 뜨지 않으므로 '사용법 다시 보기' 주소로 연다
    await page.goto("/?tour=1");
    const tour = page.getByRole("dialog", { name: "서비스 둘러보기" });
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("heading", { name: "학과 캘린더" })).toBeVisible();
    const titles = ["학과 캘린더"];
    for (let i = 0; i < 12; i++) {
      const next = tour.getByRole("button", { name: "다음" });
      if (!(await next.isVisible())) break;
      await next.click();
      titles.push((await tour.getByRole("heading").textContent()) ?? "");
      if (i === 1) await page.screenshot({ path: `test-results/tour-${name}.png` });
    }
    expect(titles).toEqual(["학과 캘린더", "AI 주간 브리핑", "학사 캘린더", "내 캘린더", "내 시간표", "학년별 소통방", "공지 · 질문 · 검색", "공식당 메뉴", "알림 받기"]);
    await expect(tour.getByText("9 / 9")).toBeVisible();
    await tour.getByRole("button", { name: "시작하기" }).click();
    await expect(tour).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    // 끝낸 기기에서는 다시 오지 않는다
    expect(await page.evaluate(() => localStorage.getItem("caialender_tour_done_v1"))).toBe("1");
    // '그만 보기'로도 바로 닫힌다
    await page.goto("/?tour=1");
    await tour.getByRole("button", { name: "그만 보기" }).click();
    await expect(tour).toBeHidden();
    await page.close();
  });
}

test("둘러보기는 계정 기준: 처음 계정엔 뜨고, 그만 보기 하면 다른 기기(브라우저)에서도 다시 안 뜬다", async ({ browser }) => {
  const email = `${prefix}-acct@caialender-test.dev`;
  const a = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signupViaUi(a, { name: "계정기준", studentNo: "2027000000", grade: 1, email });
  await a.goto("/?tour=auto");
  const tourA = a.getByRole("dialog", { name: "서비스 둘러보기" });
  await expect(tourA).toBeVisible();
  await tourA.getByRole("button", { name: "그만 보기" }).click();
  await expect(tourA).toBeHidden();
  // 계정(로그인 정보)에 기록된다
  await expect
    .poll(async () => {
      const { data } = await service().auth.admin.listUsers({ perPage: 1000 });
      return data.users.find((u) => u.email === email)?.user_metadata?.tour_done;
    })
    .toBe(true);
  await a.close();

  // 다른 기기: 저장된 기록이 없는 새 브라우저로 로그인해도 뜨지 않는다
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const b = await ctx.newPage();
  await loginViaUi(b, email);
  await b.waitForURL((u) => !u.pathname.startsWith("/login"));
  await b.goto("/?tour=auto");
  await b.locator(".caialender-calendar").waitFor();
  await b.waitForTimeout(1200);
  await expect(b.getByRole("dialog", { name: "서비스 둘러보기" })).toHaveCount(0);
  await ctx.close();
});

