/**
 * AI 장애 시나리오. AI 주소를 일부러 끊은 서버(E2E_AI_DOWN_URL)에 대해서만 실행한다.
 *   AI_BASE_URL=http://127.0.0.1:9/v1 npx next start -p 3200
 *   E2E_AI_DOWN_URL=http://localhost:3200 npm run test:e2e -- e2e/stage5-resilience.spec.ts
 */
import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, service, signupViaUi } from "./helpers";

const base = process.env.E2E_AI_DOWN_URL;
test.skip(!base, "E2E_AI_DOWN_URL이 없으면 건너뜀");
test.use({ baseURL: base });
test.describe.configure({ mode: "serial" });

const tag = Date.now().toString(36);
const prefix = `e2e5-${tag}`;
const T = `E2E5-${tag}`;
const adminEmail = `${prefix}-admin@caialender-test.dev`;
let eventId = "";

test.beforeAll(async () => {
  const start = new Date(Date.now() + 2 * 86400_000).toISOString();
  const { data, error } = await service()
    .from("events")
    .insert({ title: `${T} 학과 총회`, start_at: start, status: "published", target_grades: [] })
    .select("id")
    .single();
  if (error) throw error;
  eventId = data.id;
});

test.afterAll(async () => {
  const s = service();
  await s.from("events").delete().like("title", `${T}%`);
  await s.from("notices").delete().like("title", `${T}%`);
  await deleteUsersByPrefix(prefix);
});

test("AI 장애: 전체 캘린더·일정 상세는 정상, 브리핑만 안내 문구", async ({ page }) => {
  await signupViaUi(page, { name: "장애조회", studentNo: "2027000008", grade: 2, email: `${prefix}-view@caialender-test.dev` });
  await page.goto("/");
  await expect(page.getByText(`${T} 학과 총회`).first()).toBeVisible();
  await expect(page.getByText("지금은 AI 브리핑을 만들 수 없어요. 캘린더에서 일정을 확인해 주세요.")).toBeVisible({ timeout: 30_000 });
  await page.goto(`/events/${eventId}`);
  await expect(page.getByRole("heading", { name: `${T} 학과 총회` })).toBeVisible();
});

test("AI 장애: 공지는 저장되고 분석은 재시도 대기 후 실패로 표시, 직접 일정 추가는 가능", async ({ page }) => {
  await signupViaUi(page, { name: "장애기획", studentNo: "2025000009", grade: 3, email: adminEmail });
  await expect(page).toHaveURL(/\/my$/);
  // 내 캘린더도 정상
  await expect(page.locator("aside").getByText(`${T} 학과 총회`)).toBeVisible();
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  await s.from("profiles").update({ role: "admin" }).eq("id", data.users.find((u) => u.email === adminEmail)!.id);

  await page.goto("/admin/notices/new");
  await page.getByLabel("공지 제목").fill(`${T} 장애 중 등록한 공지`);
  await page.getByLabel("공지 본문").fill("11월 20일 오후 6시 학과 체육대회, 장소 대운동장");
  await page.getByRole("button", { name: "등록하고 AI 분석 시작" }).click();
  await expect(page).toHaveURL(/\/admin\/notices\/[0-9a-f-]{36}$/);
  // 첫 시도 실패 → 재시도 대기(분석 대기) 상태로 돌아가고, 원문은 그대로 보존
  await expect(page.getByText("11월 20일 오후 6시 학과 체육대회")).toBeVisible();
  const id = page.url().split("/").pop()!;
  await expect
    .poll(async () => (await s.from("notices").select("status, attempts, last_error").eq("id", id).single()).data, { timeout: 30_000 })
    .toMatchObject({ status: "queued", attempts: 1 });
  const { data: n } = await s.from("notices").select("last_error").eq("id", id).single();
  expect(n!.last_error).toContain("AI 서버에 연결하지 못했습니다");

  // 재시도 작업(cron)을 2번 더 호출하면 최대 시도 횟수에 도달해 실패로 표시
  for (let i = 0; i < 2; i++) {
    const res = await page.request.post("/api/jobs/analyze", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.ok()).toBe(true);
  }
  // 인증 없는 호출은 거부
  expect((await page.request.post("/api/jobs/analyze")).status()).toBe(401);

  await page.reload();
  await expect(page.getByText("분석 실패").first()).toBeVisible();
  await expect(page.getByText(/AI 분석 실패: .*다시 분석하거나 일정을 직접 추가하세요/)).toBeVisible();

  // 관리자는 AI 없이도 일정을 직접 추가·게시할 수 있다
  await page.goto("/admin/events/new");
  await page.getByLabel("제목").fill(`${T} 학과 체육대회`);
  await page.getByLabel("장소").fill("대운동장");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}$/);
  await page.goto("/");
  await expect(page.getByText(`${T} 학과 체육대회`).first()).toBeVisible();
});
