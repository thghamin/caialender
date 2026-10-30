import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, service, signupViaUi } from "./helpers";

const tag = Date.now().toString(36);
const prefix = `e2e2-${tag}`;
const T = `E2E2-${tag}`;

// 오늘 기준 KST 날짜 문자열
function kstDay(offsetDays: number, hh = 0, mm = 0) {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  const ymd = d.toISOString().slice(0, 10);
  return new Date(`${ymd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`).toISOString();
}

const ids: Record<string, string> = {};

test.beforeAll(async () => {
  const s = service();
  const rows = [
    { key: "g1", title: `${T} 새내기 배움터`, kind: "event", start_at: kstDay(2, 9), end_at: kstDay(2, 18), target_grades: [1], location: "IT-5호관" },
    { key: "g2", title: `${T} 2학년 전공 설명회`, kind: "event", start_at: kstDay(3, 16), end_at: kstDay(3, 18), target_grades: [2] },
    { key: "all", title: `${T} 학과 총회`, kind: "event", start_at: kstDay(4, 18), end_at: kstDay(4, 20), target_grades: [] },
    { key: "dl", title: `${T} 장학금 신청 마감`, kind: "deadline", start_at: kstDay(5, 23, 59), end_at: null, target_grades: [] },
    { key: "draft", title: `${T} 검수 전 초안`, kind: "event", start_at: kstDay(2, 10), end_at: null, target_grades: [], status: "draft" },
  ];
  for (const { key, ...r } of rows) {
    const { data, error } = await s
      .from("events")
      .insert({ status: "published", ...r })
      .select("id")
      .single();
    if (error) throw error;
    ids[key] = data.id;
  }
});

test.afterAll(async () => {
  await service().from("events").delete().like("title", `${T}%`);
  await deleteUsersByPrefix(prefix);
});

test("학과 캘린더에 게시된 일정만 보이고 초안은 안 보인다", async ({ page }) => {
  await signupViaUi(page, { name: "조회만", studentNo: "2027000004", grade: 2, email: `${prefix}-view@caialender-test.dev` });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "학과 캘린더" })).toBeVisible();
  await expect(page.locator(".caialender-calendar")).toBeVisible();
  await expect(page.getByText(`${T} 학과 총회`).first()).toBeVisible();
  await expect(page.getByText(`${T} 검수 전 초안`)).toHaveCount(0);
  // 초안은 URL로 직접 들어가도 안 보인다
  // (로딩 화면을 먼저 스트리밍하므로 HTTP 상태는 200일 수 있지만, 화면은 404이고 초안 내용은 없다)
  await page.goto(`/events/${ids.draft}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByText(`${T} 검수 전 초안`)).toHaveCount(0);
});

test("1학년: 내 캘린더에 1학년·전체 대상만, 관심 추가하면 2학년 일정도", async ({ page }) => {
  await signupViaUi(page, { name: "이일학", studentNo: "2027000001", grade: 1, email: `${prefix}-g1@caialender-test.dev` });
  await expect(page).toHaveURL(/\/my$/);
  const side = page.locator("aside");
  await expect(side.getByText(`${T} 새내기 배움터`)).toBeVisible();
  await expect(side.getByText(`${T} 학과 총회`)).toBeVisible();
  await expect(side.getByText(`${T} 장학금 신청 마감`)).toBeVisible();
  await expect(side.getByText(`${T} 2학년 전공 설명회`)).toHaveCount(0);

  // 일정 상세에서 관심 일정 추가
  await page.goto(`/events/${ids.g2}`);
  await expect(page.getByRole("heading", { name: `${T} 2학년 전공 설명회` })).toBeVisible();
  await page.getByRole("button", { name: "☆ 내 캘린더에 추가" }).click();
  await expect(page.getByRole("button", { name: "★ 내 캘린더에서 빼기" })).toBeVisible();

  await page.goto("/my");
  await expect(page.locator("aside").getByText(`${T} 2학년 전공 설명회`)).toBeVisible();

  // 빼기
  await page.goto(`/events/${ids.g2}`);
  await page.getByRole("button", { name: "★ 내 캘린더에서 빼기" }).click();
  await expect(page.getByRole("button", { name: "☆ 내 캘린더에 추가" })).toBeVisible();
});

test("개인 일정: 학과 일정과 겹치면 경고, 확인 후 저장, 상세에도 충돌 표시", async ({ page }) => {
  await signupViaUi(page, { name: "최충돌", studentNo: "2027000002", grade: 1, email: `${prefix}-c@caialender-test.dev` });
  await expect(page).toHaveURL(/\/my$/);

  const ymd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  // 오전/오후 → 시 → 분 버튼으로 고른다
  const pick = async (label: "시작" | "종료", ampm: "오전" | "오후", hour: number, minute = "00") => {
    await page.getByRole("button", { name: `${label} ${ampm}`, exact: true }).click();
    await page.getByRole("button", { name: `${label} ${hour}시`, exact: true }).click();
    await page.getByRole("button", { name: `${label} ${minute}분`, exact: true }).click();
  };
  await page.getByLabel("제목").fill("편의점 알바");
  await page.getByLabel("날짜").fill(ymd(kstDay(2)));
  await pick("시작", "오후", 3);
  // 종료는 시작 + 1시간을 따라오다가, 직접 고르면 그 값으로
  await expect(page.getByText("오후 3:00 ~ 오후 4:00")).toBeVisible();
  await pick("종료", "오후", 8);
  await expect(page.getByText("오후 3:00 ~ 오후 8:00")).toBeVisible();
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText(/다음 일정과 시간이 겹칩니다: .*새내기 배움터/)).toBeVisible();

  await page.getByRole("button", { name: "겹쳐도 추가하기" }).click();
  await expect(page.getByText("개인 일정을 추가했습니다.")).toBeVisible();
  await expect(page.getByText("편의점 알바").first()).toBeVisible();

  await page.goto(`/events/${ids.g1}`);
  await expect(page.getByText(/내 일정과 시간이 겹칩니다: 편의점 알바/)).toBeVisible();

  // 겹치지 않는 일정은 바로 저장
  await page.goto("/my");
  await page.getByLabel("제목").fill("스터디");
  await page.getByLabel("날짜").fill(ymd(kstDay(6)));
  await pick("시작", "오전", 10);
  // 개인 일정의 분은 :00 / :30 두 가지뿐
  await pick("종료", "오후", 12, "30");
  await expect(page.getByRole("button", { name: "종료 10분" })).toHaveCount(0);
  await expect(page.getByText("오전 10:00 ~ 오후 12:30")).toBeVisible();
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("개인 일정을 추가했습니다.")).toBeVisible();

  // 다른 학생에게는 내 개인 일정이 보이지 않는다
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await signupViaUi(page, { name: "타학생", studentNo: "2027000003", grade: 1, email: `${prefix}-other@caialender-test.dev` });
  await expect(page).toHaveURL(/\/my$/);
  await expect(page.getByText(`${T} 새내기 배움터`).first()).toBeVisible();
  await expect(page.getByText("편의점 알바")).toHaveCount(0);
});
