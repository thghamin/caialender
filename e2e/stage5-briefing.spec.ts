import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, service, signupViaUi } from "./helpers";

const tag = Date.now().toString(36);
const prefix = `e2e5b-${tag}`;
const T = `E2E5B${tag}`;

// 이번 주(KST 월~일) 안에서 아직 지나지 않은 시각
function laterThisWeek(hoursAhead: number) {
  const t = Date.now() + hoursAhead * 3600_000;
  const kst = new Date(t + 9 * 3600_000);
  const dow = (kst.getUTCDay() + 6) % 7;
  const sundayEnd = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + (6 - dow), 23, 0) - 9 * 3600_000;
  return new Date(Math.min(t, sundayEnd)).toISOString();
}

// 화면 표시 형식 "11월 4일(수) 13:00" (lib/datetime formatKst와 같은 형식)
function kstText(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const w = "일월화수목금토"[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${w}) ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
const mentoringAt = laterThisWeek(3);

test.beforeAll(async () => {
  const { error } = await service().from("events").insert([
    // 이미 끝난 일정은 브리핑에 나오면 안 된다
    { title: `${T} 지난 설명회`, start_at: new Date(Date.now() - 3 * 3600_000).toISOString(), end_at: new Date(Date.now() - 2 * 3600_000).toISOString(), status: "published", target_grades: [], location: null },
    { title: `${T} 1학년 멘토링`, start_at: mentoringAt, status: "published", target_grades: [1], location: "IT-5호관 101호" },
    { title: `${T} 3학년 취업특강`, start_at: laterThisWeek(4), status: "published", target_grades: [3], location: null },
  ]);
  if (error) throw error;
});

test.afterAll(async () => {
  const s = service();
  await s.from("events").delete().like("title", `${T}%`);
  await s.from("briefings").delete().is("user_id", null);
  await deleteUsersByPrefix(prefix);
});

test("전체 브리핑은 이번 주 일정을, 개인 브리핑은 내 학년 일정만 정리한다", async ({ page }) => {
  test.setTimeout(120_000);
  // 서비스는 승인된 회원 전용이므로 먼저 가입·승인한다
  await signupViaUi(page, { name: "브리핑", studentNo: "2027000077", grade: 1, email: `${prefix}@caialender-test.dev` });
  await page.goto("/");
  const card = page.getByTestId("briefing-card");
  await expect(card.getByText(/게시한 일정만으로 AI가 정리했어요/)).toBeVisible({ timeout: 60_000 });
  const all = await card.innerText();
  console.log("전체 브리핑:\n" + all);
  expect(all).toContain(`${T} 1학년 멘토링`);
  expect(all).toContain(`${T} 3학년 취업특강`);
  expect(all).not.toContain(`${T} 지난 설명회`);
  // 날짜·시각은 AI가 옮겨 적지 않고 일정 그대로 (굵은 날짜 줄)
  await expect(card.getByTestId("briefing-items").getByText(kstText(mentoringAt))).toBeVisible();

  await page.goto("/my");
  const myCard = page.getByTestId("briefing-card");
  await expect(myCard.getByText(/게시한 일정만으로 AI가 정리했어요/)).toBeVisible({ timeout: 60_000 });
  const mine = await myCard.innerText();
  console.log("개인 브리핑:\n" + mine);
  expect(mine).toContain(`${T} 1학년 멘토링`);
  expect(mine).not.toContain(`${T} 3학년 취업특강`);

  // 두 번째 방문은 DB 캐시에서 바로 나온다
  const t0 = Date.now();
  const res = await page.request.get("/api/briefing?scope=me");
  expect((await res.json()).cached).toBe(true);
  expect(Date.now() - t0).toBeLessThan(3000);
});
