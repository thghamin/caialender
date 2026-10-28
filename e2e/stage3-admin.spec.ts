import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { deleteUsersByPrefix, service, signupViaUi } from "./helpers";

const tag = Date.now().toString(36);
const prefix = `e2e3-${tag}`;
const T = `E2E3-${tag}`;
const adminEmail = `${prefix}-admin@caialender-test.dev`;
const studentEmail = `${prefix}-s1@caialender-test.dev`;

// 공지 게시일 기준으로 "다음 달 18일" 같은 상대 날짜를 만들기 위한 헬퍼
const now = new Date(Date.now() + 9 * 3600_000);
const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
const M = next.getUTCMonth() + 1;
const Y = next.getUTCFullYear();
const ymd = (d: number) => `${Y}-${String(M).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

test.describe.configure({ mode: "serial" });

// AI가 만든 일정 제목에는 테스트 태그가 없을 수 있으므로, 이 테스트가 만든 일정 id를 따로 모아 지운다
const createdEventIds = new Set<string>();

async function rememberNoticeEvents(noticeId: string) {
  const { data } = await service().from("events").select("id").eq("notice_id", noticeId);
  for (const e of data ?? []) createdEventIds.add(e.id);
}

test.afterAll(async () => {
  const s = service();
  const { data: notices } = await s.from("notices").select("id, image_path").like("title", `${T}%`);
  for (const n of notices ?? []) await rememberNoticeEvents(n.id);
  const paths = (notices ?? []).map((n) => n.image_path).filter(Boolean) as string[];
  if (paths.length) await s.storage.from("posters").remove(paths);
  if (createdEventIds.size) await s.from("events").delete().in("id", [...createdEventIds]);
  await s.from("events").delete().like("title", `%${tag}%`);
  await s.from("notices").delete().like("title", `${T}%`);
  await deleteUsersByPrefix(prefix);
});

async function becomeAdmin(page: Page) {
  await signupViaUi(page, { name: "박기획", studentNo: "2025000001", grade: 3, email: adminEmail });
  await expect(page).toHaveURL(/\/my$/);
  const s = service();
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 });
  await s.from("profiles").update({ role: "admin" }).eq("id", data.users.find((u) => u.email === adminEmail)!.id);
}

/** 공지 등록 후 AI 분석이 끝날 때까지 기다린다 (화면 자동 새로고침) */
async function submitNotice(page: Page, title: string, body: string, image?: string) {
  await page.goto("/admin/notices/new");
  await page.getByLabel("공지 제목").fill(title);
  await page.getByLabel("공지 본문").fill(body);
  if (image) await page.getByLabel(/포스터 이미지/).setInputFiles(image);
  const t0 = Date.now();
  await page.getByRole("button", { name: "등록하고 AI 분석 시작" }).click();
  await expect(page).toHaveURL(/\/admin\/notices\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/분석 완료|분석 실패/).first()).toBeVisible({ timeout: 90_000 });
  console.log(`[${title}] 등록~분석 완료 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await rememberNoticeEvents(page.url().split("/").pop()!);
  await expect(page.getByText("분석 완료").first()).toBeVisible();
}

test("텍스트 공지 → AI 초안 → 검수·수정 → 게시 → 학생 캘린더 반영", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await becomeAdmin(page);

  await submitNotice(
    page,
    `${T} 새내기 배움터 안내`,
    `[인공지능전공 학생회] 새내기 배움터 ${tag} 안내\n\n✅ 일시: ${M}월 24일 ~ ${M}월 25일, 1박 2일\n✅ 집결: ${M}/24 오전 9시 IT-5호관 앞\n✅ 장소: 경주 블루원 리조트\n✅ 대상: 신입생\n✅ 참가비: 3만원\n✅ 신청: ~${M}월 13일 23:59까지 구글폼\n※ 재학생 도우미는 ${M}월 10일까지 학생회 카톡으로 연락`,
  );

  // AI가 만든 초안: 행사 + 신청 마감 이상
  const items = page.locator("li", { hasText: "검수 대기" });
  expect(await items.count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/배움터/).first()).toBeVisible();

  // 초안은 아직 학생에게 안 보인다
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await signupViaUi(student, { name: "이신입", studentNo: "2027000010", grade: 1, email: studentEmail });
  await expect(student).toHaveURL(/\/my$/);
  await expect(student.locator("aside").getByText(/배움터/)).toHaveCount(0);

  // 마감 일정 하나를 열어 제목에 태그를 붙여 수정 (검수 과정)
  const s = service();
  const { data: notice } = await s.from("notices").select("id, ai_model").like("title", `${T} 새내기%`).single();
  const { data: drafts } = await s.from("events").select("*").eq("notice_id", notice!.id);
  console.log("AI 모델:", notice!.ai_model, "\n초안:", drafts!.map((d) => `${d.kind} ${d.title} ${d.start_at} ${d.location}`).join("\n"));
  const deadline = drafts!.find((d) => d.kind === "deadline" && d.start_at.startsWith(ymd(13)))
    ?? drafts!.find((d) => d.kind === "deadline" && new Date(d.start_at).toISOString() === new Date(`${ymd(13)}T23:59:00+09:00`).toISOString());
  expect(deadline, "신청 마감(13일) 초안").toBeDefined();
  const main = drafts!.find((d) => d.kind === "event" && /배움터/.test(d.title));
  expect(main, "배움터 행사 초안").toBeDefined();
  expect(main!.target_grades).toEqual([1]);

  await page.goto(`/admin/events/${deadline!.id}`);
  await page.getByLabel("제목").fill(`새터 신청 마감 ${tag}`);
  await page.getByLabel("상태").selectOption("draft");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했습니다.")).toBeVisible();

  // 모두 게시
  await page.goto(`/admin/notices/${notice!.id}`);
  await page.getByRole("button", { name: /모두 게시/ }).click();
  // 버튼 문구가 '게시 중…'으로 바뀌는 것만으로는 완료가 아니므로, 검수 대기 표시가 모두 사라질 때까지 기다린다
  await expect(page.getByText("검수 대기", { exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("게시됨", { exact: true }).first()).toBeVisible();

  // 학생 캘린더에 반영
  await student.goto("/my");
  await expect(student.locator("aside").getByText(`새터 신청 마감 ${tag}`)).toBeVisible();
  await expect(student.locator("aside").getByText(main!.title)).toBeVisible();
  await studentCtx.close();
});

test("포스터 이미지 공지 → AI가 이미지에서 일정 추출", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("이메일").fill(adminEmail);
  await page.getByLabel("비밀번호").fill("e2e-Password-123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/my$/);

  await submitNotice(page, `${T} 특강 포스터 ${tag}`, "", path.resolve("tests/fixtures/poster-lecture.png"));
  await expect(page.getByRole("img", { name: "공지 포스터" })).toBeVisible();
  const s = service();
  const { data: notice } = await s.from("notices").select("id, posted_at").like("title", `${T} 특강%`).single();
  const { data: drafts } = await s.from("events").select("*").eq("notice_id", notice!.id);
  console.log("포스터 초안:", drafts!.map((d) => `${d.kind} ${d.title} ${d.start_at} ${d.location} ${d.target_grades}`).join("\n"));
  const lecture = drafts!.find((d) => d.kind === "event");
  expect(lecture?.location).toContain("224");
  expect(lecture?.target_grades).toEqual([2, 3, 4]);
  // 포스터의 "3월 18일 오후 4시"는 게시일 이후 가장 가까운 3월 18일 16:00 KST
  expect(new Date(lecture!.start_at).getUTCHours()).toBe(7);
  expect(drafts!.some((d) => d.kind === "deadline")).toBe(true);
  // 테스트 정리를 위해 제목에 태그 붙이기
  await s.from("events").update({ status: "published" }).eq("notice_id", notice!.id);
  for (const d of drafts!) await s.from("events").update({ title: `${d.title} ${tag}` }).eq("id", d.id);
});

test("변경 공지 → AI가 기존 일정 변경 감지 → 반영 → 학생 화면에 변경 이력", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("이메일").fill(adminEmail);
  await page.getByLabel("비밀번호").fill("e2e-Password-123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/my$/);

  const s = service();
  const { data: lecture } = await s.from("events").select("*").like("title", `%특강%${tag}`).eq("kind", "event").single();
  expect(lecture).toBeTruthy();

  await submitNotice(
    page,
    `${T} 특강 장소 변경`,
    `[장소 변경 안내] 현직자 초청 특강\n\n3월 18일(목) 현직자 초청 특강 장소가 변경되었습니다.\n기존: IT-5호관 224호 → 변경: IT-5호관 345호 (대형 강의실)\n시간은 동일하게 오후 4시입니다.`,
  );
  await expect(page.getByText("기존 일정 변경 감지")).toBeVisible();
  await expect(page.getByText(/장소: IT-5호관 224호 → .*345/)).toBeVisible();

  await page.getByRole("button", { name: "반영" }).first().click();
  await expect(page.getByText("반영됨")).toBeVisible({ timeout: 15_000 });

  const { data: updated } = await s.from("events").select("location").eq("id", lecture!.id).single();
  expect(updated!.location).toContain("345");

  // 학생(여기서는 관리자 계정) 화면의 변경 이력
  await page.goto(`/events/${lecture!.id}`);
  await expect(page.getByText("변경 이력")).toBeVisible();
  await expect(page.getByText(/224호 → .*345/)).toBeVisible();
});

test("공지 삭제 시 검수 전 초안만 지워지고 게시된 일정은 남는다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(adminEmail);
  await page.getByLabel("비밀번호").fill("e2e-Password-123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/my$/);

  const s = service();
  const { data: notice } = await s.from("notices").select("id").like("title", `${T} 새내기%`).single();
  const { data: before } = await s.from("events").select("id, status").eq("notice_id", notice!.id);
  const published = before!.filter((e) => e.status === "published").map((e) => e.id);

  page.on("dialog", (d) => d.accept());
  await page.goto(`/admin/notices/${notice!.id}`);
  await page.getByRole("button", { name: "공지 삭제" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const { data: after } = await s.from("events").select("id").in("id", published);
  expect(after!.length).toBe(published.length);
  // 정리용 태그
  for (const id of published) {
    const { data } = await s.from("events").select("title").eq("id", id).single();
    if (!data!.title.includes(tag)) await s.from("events").update({ title: `${data!.title} ${tag}` }).eq("id", id);
  }
});
