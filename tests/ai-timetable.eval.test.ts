/**
 * 실제 AI로 에타 시간표 스크린샷을 끝까지 읽어 보는 평가 테스트 (AI_EVAL=1 이고 개인 스크린샷이 있을 때만)
 *   AI_EVAL=1 node --env-file=.env.local node_modules/.bin/vitest run tests/ai-timetable.eval.test.ts --silent=false
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const FRIEND = "tests/fixtures/private/everytime-friend.png";
const MINE = "tests/fixtures/private/everytime-full.png";
const run = process.env.AI_EVAL === "1" && existsSync(FRIEND) ? describe : describe.skip;
const days = "월화수목금토일";
const list = (courses: { name: string; slots: { day: number; start_min: number; end_min: number }[] }[]) =>
  courses.flatMap((c) => c.slots.map((s) => `${days[s.day]} ${s.start_min / 60}-${s.end_min / 60} ${c.name.replace(/\s/g, "")}`)).sort();

run("에타 시간표 가져오기 (실제 AI)", () => {
  it("다른 사람 시간표: 수업 이름·요일·시각을 모두 맞게 읽는다", { timeout: 180_000 }, async () => {
    const { analyzeByBlocks } = await import("@/lib/timetable-import");
    const r = await analyzeByBlocks(readFileSync(FRIEND));
    expect(r).not.toBeNull();
    const got = list(r!.courses);
    console.log(got.join("\n"));
    expect(got).toEqual(
      [
        "수 9-10.5 기계학습입문",
        "월 10.5-12 공학수학1",
        "화 10.5-12 신경망개론",
        "월 13.5-15 기계학습입문",
        "수 13.5-15 공학수학1",
        "금 13-16 심리학의이해",
        "화 15-16.5 문제해결과알고리즘",
        "수 15-16.5 신경망개론",
        "목 15-16.5 문제해결과알고리즘",
        "화 16.5-18 확률및통계",
        "목 16.5-18 확률및통계",
      ].sort(),
    );
  });

  it.skipIf(!existsSync(MINE))("아래가 잘린 내 시간표: 이름·시작 시각을 맞게 읽고, 잘린 칸은 확인 표시", { timeout: 180_000 }, async () => {
    const { analyzeByBlocks } = await import("@/lib/timetable-import");
    const r = await analyzeByBlocks(readFileSync(MINE));
    const got = list(r!.courses).map((g) => g.replace(/-[\d.]+ /, " "));
    console.log(list(r!.courses).join("\n"));
    expect(got).toEqual(
      [
        "월 9 동역학", "수 9 동역학", "화 9 로봇제어1", "목 10.5 로봇제어1", "금 10.5 이산수학", "수 13.5 이산수학",
        "월 13 로봇운영체제실습", "화 13 모델링및시뮬레이션", "수 15 인공지능세미나특강", "목 14 컴퓨팅사고와SW코딩",
      ].sort(),
    );
    expect(r!.courses.filter((c) => c.check).length).toBeGreaterThanOrEqual(2);
  });

  const DARK = "tests/fixtures/private/everytime-dark.png";
  it.skipIf(!existsSync(DARK))("다크 모드 시간표: 이름·요일·시각을 모두 맞게 읽는다", { timeout: 180_000 }, async () => {
    const { analyzeByBlocks } = await import("@/lib/timetable-import");
    const r = await analyzeByBlocks(readFileSync(DARK));
    console.log(list(r!.courses).join("\n"));
    // 긴 과목명의 문장부호(: ,)는 AI가 빼먹을 수 있어 글자만 비교한다
    const got = list(r!.courses).map((g) => g.replace(/[^\p{L}\p{N}. -]/gu, ""));
    const sky = "하늘을재고땅을나누다조선의과학일상을바꾸다";
    expect(got).toEqual(
      [
        "월 10.5-12 학교문법론", "수 10.5-12 학교문법론", "화 11-13 교육사회", "목 11-13 교육과정",
        "화 13.5-15 음운교육론", "목 13.5-15 음운교육론", "월 15-16.5 고전소설교육론", "수 15-16.5 고전소설교육론",
        "화 15-16.5 문학교육론", "목 15-16.5 문학교육론", `화 16.5-18 ${sky}`, `목 16.5-18 ${sky}`,
      ].sort(),
    );
  });

  const SIM = "tests/fixtures/private/everytime-friend-darksim.png";
  it.skipIf(!existsSync(SIM))("다크 모드(새까만 글자) 친구 시간표도 라이트 모드와 똑같이 읽는다", { timeout: 180_000 }, async () => {
    const { analyzeByBlocks } = await import("@/lib/timetable-import");
    const [dark, light] = await Promise.all([analyzeByBlocks(readFileSync(SIM)), analyzeByBlocks(readFileSync(FRIEND))]);
    console.log(list(dark!.courses).join("\n"));
    expect(list(dark!.courses)).toEqual(list(light!.courses));
  });

  const SAT = "tests/fixtures/private/everytime-saturday.png";
  it.skipIf(!existsSync(SAT))("토요일·긴 수업·진한 색 칸(흰 글씨) 시간표", { timeout: 180_000 }, async () => {
    const { analyzeByBlocks } = await import("@/lib/timetable-import");
    const r = await analyzeByBlocks(readFileSync(SAT));
    console.log(list(r!.courses).join("\n"));
    const got = list(r!.courses).map((g) => g.replace(/[^\p{L}\p{N}. -]/gu, ""));
    expect(got).toEqual(
      [
        "월 13.5-15 기계학습입문", "수 9-10.5 기계학습입문", "화 9-10.5 확률및통계", "목 10.5-12 확률및통계",
        "화 10.5-12 신경망개론", "수 15-16.5 신경망개론", "월 16.5-18 딥러닝", "수 16.5-18 딥러닝",
        "목 14-18 컴퓨팅사고와SW코딩", "금 10-11 창의및융합적사고", "금 13-15 인공지능", "토 9-21.5 휴먼케어",
      ].sort(),
    );
    // 화면 아래로 이어지는 긴 수업은 끝 시각 확인 표시
    expect(r!.courses.find((c) => c.name.includes("휴먼"))?.check).toBeTruthy();
  });
});

