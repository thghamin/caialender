import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

// 내 시간표(직접 추가·에타 스크린샷 AI), 휴대폰 알림(일정 하루 전·수업 10분 전), AI 근거·학생회 성과 지표
const tag = Date.now().toString(36);
const prefix = `e2e8-${tag}`;
const T = `E2E8-${tag}`;
const email = (k: string) => `${prefix}-${k}@caialender-test.dev`;
const ids: Record<string, string> = {};
const SAMPLE = path.join(__dirname, "../tests/fixtures/private/everytime-full.png");

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  for (const k of ["student", "admin"]) {
    const page = await browser.newPage();
    await signupViaUi(page, { name: `시간표${k}`, studentNo: "2027000000", grade: 2, email: email(k) });
    await page.close();
  }
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.startsWith(prefix))) ids[u.email!.slice(prefix.length + 1).split("@")[0]] = u.id;
  await s.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
});

test.afterAll(async () => {
  const s = service();
  await s.from("events").delete().like("title", `${T}%`);
  const { data: notices } = await s.from("notices").select("id").like("title", `${T}%`);
  for (const n of notices ?? []) await s.from("events").delete().eq("notice_id", n.id);
  // 테스트 공지가 만든 변경 제안은 실제 일정에 걸려 있을 수 있으므로 공지보다 먼저 지운다
  const { data: testNotices } = await s.from("notices").select("id").like("title", `${T}%`);
  if (testNotices?.length) await s.from("event_changes").delete().in("notice_id", testNotices.map((n) => n.id));
  await s.from("notices").delete().like("title", `${T}%`);
  await deleteUsersByPrefix(prefix); // 시간표·알림 설정·구독·알림 기록은 회원 삭제와 함께 지워진다
});

async function login(page: Page, k: string) {
  await loginViaUi(page, email(k));
  await page.waitForURL("**/my");
}

test("시간표: 에타처럼 수업을 직접 추가하고(5분 단위 시계), 수정·알림·삭제한다", async ({ page }) => {
  await login(page, "student");
  await page.getByRole("link", { name: "내 시간표" }).click();
  await expect(page.getByRole("heading", { name: "내 시간표" })).toBeVisible();

  await page.getByRole("button", { name: "+ 수업 추가" }).click();
  const sheet = page.getByRole("dialog", { name: "수업 추가" });
  await sheet.getByLabel("수업명").fill(`${T} 동역학`);
  await sheet.getByLabel("교수명").fill("이재욱");
  // 시간 1: 기본 월 09:00-10:15 → 시작을 오후 1시로 (길이 75분 유지), 종료 분은 시계에서 5분 단위
  await sheet.getByRole("button", { name: "시간 1 시작 오후" }).click();
  await sheet.getByRole("button", { name: "시간 1 시작 1시" }).click();
  await expect(sheet.getByRole("button", { name: "시간 1 시각" })).toHaveText(/13:00 - 14:15/);
  await sheet.getByRole("tab", { name: /종료/ }).click();
  await expect(sheet.getByRole("slider", { name: "시간 1 종료 분" })).toBeVisible();
  await sheet.getByRole("button", { name: "시간 1 종료 5분 더하기" }).click();
  await expect(sheet.getByRole("button", { name: "시간 1 시각" })).toHaveText(/13:00 - 14:20/);
  // 개인 일정과 달리 분 버튼은 없고 시계만
  await expect(sheet.getByRole("button", { name: "시간 1 종료 :10" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "완료" }).last().click();
  await sheet.getByLabel("시간 1 장소").fill("복현회관-308");
  // 시간 및 장소 추가 → 다음 요일(화)
  await sheet.getByRole("button", { name: "시간 및 장소 추가" }).click();
  await expect(sheet.getByLabel("시간 2 요일")).toHaveValue("1");
  await sheet.getByRole("button", { name: "완료" }).first().click();
  await expect(sheet).toBeHidden();

  const grid = page.getByTestId("timetable-grid");
  await expect(grid.getByText(`${T} 동역학`).first()).toBeVisible();
  await expect(page.getByText("월 13:00-14:20 복현회관-308 / 화 13:00-14:20 복현회관-308")).toBeVisible();

  // 수업 10분 전 알림 켜기
  await page.getByRole("switch", { name: `${T} 동역학 10분 전 알림` }).click();
  await expect(page.getByRole("switch", { name: `${T} 동역학 10분 전 알림` })).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await service().from("timetable_courses").select("reminder").eq("user_id", ids.student).single()).data?.reminder)
    .toBe(true);

  // 칸을 눌러 수정
  await grid.getByText(`${T} 동역학`).first().click();
  const edit = page.getByRole("dialog", { name: "수업 수정" });
  await edit.getByLabel("수업명").fill(`${T} 동역학 II`);
  await edit.getByRole("button", { name: "완료" }).first().click();
  await expect(edit).toBeHidden();
  await expect(grid.getByText(`${T} 동역학 II`).first()).toBeVisible();

  // 삭제
  await grid.getByText(`${T} 동역학 II`).first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("dialog", { name: "수업 수정" }).getByRole("button", { name: "수업 삭제" }).click();
  await expect(page.getByText("아직 시간표가 없어요.")).toBeVisible();
});

test("시간표: 에타 스크린샷을 AI가 읽어 그대로 넣는다 (실제 AI)", async ({ page }) => {
  test.skip(!existsSync(SAMPLE), "에타 샘플 스크린샷(tests/fixtures/private)이 없으면 건너뜀");
  test.setTimeout(150_000);
  await login(page, "student");
  await page.goto("/timetable");
  await page.getByRole("button", { name: /에타 시간표 가져오기/ }).click();
  const sheet = page.getByRole("dialog", { name: "에타 시간표 가져오기" });
  await sheet.getByLabel("에타 시간표 스크린샷").setInputFiles(SAMPLE);
  await sheet.getByRole("button", { name: "🤖 AI로 읽기" }).click();
  await expect(sheet.getByText(/AI가 읽은 수업 \d+개/)).toBeVisible({ timeout: 120_000 });
  // 이름은 고칠 수 있는 입력칸에 들어 있다
  const names = await sheet.getByLabel("수업명 고치기").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  for (const name of ["로봇제어1", "이산수학", "모델링 및 시뮬레이션"]) expect(names).toContain(name);
  // 시각은 픽셀로 잰 30분 단위 (로봇제어1: 화 9:00-10:30, 목 10:30-12:00)
  await expect(sheet.getByText("화 09:00-10:30").first()).toBeVisible();
  await expect(sheet.getByText("목 10:30-12:00").first()).toBeVisible();
  // 추가하기 전에 AI가 읽은 이름을 바로 고칠 수 있다
  const first = sheet.getByTestId("import-course").first();
  await first.getByLabel("수업명 고치기").fill("고친 수업명");
  await sheet.getByRole("button", { name: "추가" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("timetable-grid").getByText("고친 수업명").first()).toBeVisible();
  await expect(page.getByTestId("timetable-grid").getByText("로봇제어1").first()).toBeVisible();
  const { data } = await service().from("timetable_courses").select("name, source").eq("user_id", ids.student);
  expect(data!.length).toBeGreaterThanOrEqual(6);
  expect(data!.every((c) => c.source === "ai")).toBe(true);
});

test("알림: 내 캘린더 일정 하루 전 알림을 켜면, 1분 작업이 24시간 전에 보낼 알림을 찾는다", async ({ page }) => {
  const s = service();
  // 시작이 24시간 + 1분 전에 걸쳐 있는 일정 → 알림 시각이 '방금' (보낼 대상)
  const start = new Date(Date.now() + 24 * 3600_000 - 60_000).toISOString();
  const { data: ev } = await s
    .from("events")
    .insert({ title: `${T} 알림 테스트 MT`, calendar: "dept", start_at: start, status: "published", kind: "event", target_grades: [] })
    .select("id")
    .single();
  ids.event = ev!.id;
  await login(page, "student");
  // 내 캘린더에서 일정을 눌러 하루 전 알림 켜기
  // 달력은 그달 주만 보여주므로, 일정(내일)이 다음 달이면 다음 달로 넘긴다
  const cal = page.locator(".caialender-calendar");
  const kstMonth = (t: number) => new Date(t + 9 * 3600_000).getUTCMonth();
  if (kstMonth(new Date(start).getTime()) !== kstMonth(Date.now())) await cal.getByRole("button", { name: /다음|Next/ }).first().click();
  await cal.getByText(`${T} 알림 테스트 MT`).first().click();
  const popup = page.getByRole("dialog", { name: `${T} 알림 테스트 MT` });
  await popup.getByRole("switch", { name: "하루 전 알림" }).click();
  await expect(popup.getByRole("switch", { name: "하루 전 알림" })).toHaveAttribute("aria-checked", "true");

  // 실제 휴대폰 대신 가짜 기기를 등록해 두고 1분 작업을 직접 호출
  await s.from("push_subscriptions").insert({ user_id: ids.student, endpoint: `https://push.invalid/${tag}`, p256dh: "BAAA", auth: "AAAA" });
  const res = await page.request.post("/api/jobs/analyze", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.reminders.due).toBeGreaterThanOrEqual(1);
  const { data: log } = await s.from("notification_log").select("key").eq("user_id", ids.student);
  expect(log!.map((l) => l.key)).toContain(`event:${ids.event}:${new Date(start).toISOString()}`);
  // 같은 알림은 두 번 보내지 않는다
  await page.request.post("/api/jobs/analyze", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const { count } = await s.from("notification_log").select("*", { count: "exact", head: true }).eq("user_id", ids.student);
  expect(count).toBe(1);
});

test("AI 근거: 추출한 일정의 원문 문장을 형광펜으로 보여주고, 성과 지표에 반영된다 (실제 AI)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin");
  await page.goto("/admin/notices/new");
  await page.getByText("✏️ 제목 직접 쓰기").click();
  await page.getByLabel("공지 제목").fill(`${T} 학과 체육대회 안내`);
  await page.getByLabel("공지 본문").fill("안녕하세요 학생회입니다.\n11월 20일(금) 오후 6시에 대운동장에서 학과 체육대회가 열립니다.\n많은 참여 바랍니다.");
  await page.getByRole("button", { name: "등록하고 AI 분석 시작" }).click();
  await expect(page.getByText(/🤖 근거: “.+”/).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("mark").first()).toContainText("11월 20일");

  await page.goto("/admin");
  const metrics = page.locator("div", { has: page.getByRole("heading", { name: /AI·학생회 성과/ }) }).last();
  await expect(metrics.getByText("AI가 분석한 공지")).toBeVisible();
  await expect(metrics.getByText("근거 문장 원문 일치")).toBeVisible();
});
