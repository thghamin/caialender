import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, signupViaUi } from "./helpers";

// 공식당(공학관 학생식당) 주간 메뉴: 휴대폰 더보기에서 들어가 요일별 중식·석식을 본다
const prefix = `e2e11-${Date.now().toString(36)}`;
test.afterAll(async () => deleteUsersByPrefix(prefix));

test("더보기 → 공식당 메뉴: 오늘 요일이 골라져 있고, 요일을 바꿔 중식·석식을 본다", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("install_prompt_closed", "1");
    localStorage.setItem("caialender_tour_done_v1", "1");
  });
  const page = await ctx.newPage();
  await signupViaUi(page, { name: "밥먹자", studentNo: "2027000000", grade: 2, email: `${prefix}@caialender-test.dev` });
  await page.getByRole("banner").getByRole("button", { name: "더보기" }).click();
  await page.getByRole("dialog", { name: "더보기 메뉴" }).getByRole("link", { name: /공식당 메뉴/ }).click();
  await expect(page.getByRole("heading", { name: "공식당 메뉴" })).toBeVisible();
  // 생협 홈페이지가 응답하면 요일 탭과 메뉴, 아니면 바로가기 안내
  const tabs = page.getByRole("tablist", { name: "요일" });
  const fallback = page.getByText("메뉴를 불러오지 못했어요");
  await expect(tabs.or(fallback)).toBeVisible({ timeout: 15_000 });
  if (await tabs.isVisible()) {
    await expect(tabs.getByRole("tab", { selected: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /중식/ })).toBeVisible();
    await tabs.getByRole("tab").first().click();
    await expect(tabs.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  }
  // 주 넘기기: 다음 주(오늘 표시 없음) → 이전 주로 두 번 → 지난주
  await expect(page.getByTestId("week-label")).toBeVisible();
  await page.getByRole("link", { name: "다음 주" }).click();
  await expect(page).toHaveURL(/w=1/);
  await expect(page.getByText("다음 주", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "다음 주" })).toHaveCount(0); // 다음 주가 끝
  await expect(tabs.or(fallback).or(page.getByText("이 주에는 메뉴가 없어요"))).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("오늘", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "이전 주" }).click();
  await page.getByRole("link", { name: "이전 주" }).click();
  await expect(page).toHaveURL(/w=-1/);
  await expect(page.getByText("지난주", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "이번 주로 돌아가기" }).click();
  await expect(page.getByText("이번 주", { exact: true })).toBeVisible();
  await ctx.close();
});
