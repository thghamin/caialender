import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp, { type Sharp } from "sharp";
import { detectBlocks, detectGrid, fitProgression, mergeWithBlocks } from "@/lib/timetable-vision";

describe("시간표 눈금 복원", () => {
  it("수업 칸에 가려진 선을 일정한 간격으로 복원한다", () => {
    const r = fitProgression([100, 133, 166, 265, 298], 20, 60, 400)!;
    expect(r.lines).toEqual([100, 133, 166, 199, 232, 265, 298]);
    expect(r.gap).toBeCloseTo(33, 0);
  });
  it("AI가 읽은 수업과 픽셀로 잰 칸을 맞춰 시각을 바꾸고, 잘린 칸은 AI 끝 시각을 쓴다", () => {
    const blocks = [
      { day: 0, start_min: 540, end_min: 630, top: 0, bottom: 0, color: [0, 0, 0] as [number, number, number], truncated: false },
      { day: 3, start_min: 840, end_min: 1080, top: 0, bottom: 0, color: [0, 0, 0] as [number, number, number], truncated: true },
      { day: 4, start_min: 630, end_min: 720, top: 0, bottom: 0, color: [0, 0, 0] as [number, number, number], truncated: false },
    ];
    const { courses, unmatched } = mergeWithBlocks(
      [
        { name: "동역학", slots: [{ day: 0, start_min: 540, end_min: 615 }] },
        { name: "컴퓨팅사고", slots: [{ day: 3, start_min: 780, end_min: 915 }] },
      ],
      blocks,
    );
    expect(courses[0].slots[0]).toMatchObject({ day: 0, start_min: 540, end_min: 630 });
    expect(courses[1].slots[0]).toMatchObject({ day: 3, start_min: 840, end_min: 930 }); // 잘림 → AI 끝 15:15 → 15:30
    expect(unmatched).toHaveLength(1);
  });
});

// 실제 에타 스크린샷(개인정보 포함, git 제외)이 있을 때만
const FULL = "tests/fixtures/private/everytime-full.png";
describe.skipIf(!existsSync(FULL))("실제 에타 스크린샷 픽셀 측정", () => {
  it.each([FULL, FULL.replace(".png", "-x4.png")].filter(existsSync))("모든 수업 칸의 요일·시각을 30분 단위로 정확히 잰다 (%s)", async (file) => {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const img = { data, width: info.width, height: info.height, channels: info.channels };
    const grid = detectGrid(img)!;
    const blocks = detectBlocks(img, grid, 9).map((b) => `${b.day} ${b.start_min / 60}-${b.end_min / 60}${b.truncated ? " 잘림" : ""}`);
    expect(blocks).toEqual([
      "0 9-10.5", "0 13-17",
      "1 9-10.5", "1 13-17",
      "2 9-10.5", "2 13.5-15", "2 15-18 잘림",
      "3 10.5-12", "3 14-18 잘림",
      "4 10.5-12",
    ]);
  });
});

// 다른 화면 모양(위에 학기 탭, 아래 여백)·다른 해상도·JPEG 압축에서도 같은 결과여야 한다
const FRIEND = "tests/fixtures/private/everytime-friend.png";
const SAMPLE = "tests/fixtures/private/everytime-sample.png";
const measure = async (input: Sharp) => {
  const { data, info } = await input.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data, width: info.width, height: info.height, channels: info.channels };
  return detectBlocks(img, detectGrid(img)!, 9).map((b) => `${b.day} ${b.start_min / 60}-${b.end_min / 60}${b.truncated ? " 잘림" : ""}`);
};
describe.skipIf(!existsSync(FRIEND))("다른 사람 에타 스크린샷", () => {
  const expected = [
    "0 10.5-12", "0 13.5-15",
    "1 10.5-12", "1 15-16.5", "1 16.5-18",
    "2 9-10.5", "2 13.5-15", "2 15-16.5",
    "3 15-16.5", "3 16.5-18",
    "4 13-16",
  ];
  it.each([
    ["원본", (s: Sharp) => s],
    ["0.7배", (s: Sharp) => s.resize(295)],
    ["2.5배", (s: Sharp) => s.resize(1052)],
    ["JPEG", (s: Sharp) => s.jpeg({ quality: 70 })],
  ] as const)("비슷한 파스텔색으로 붙은 칸도 나누고, 원래 아래 테두리에서 끝난 칸은 잘림이 아니다 (%s)", async (_, f) => {
    const buf = await f(sharp(FRIEND)).toBuffer();
    expect(await measure(sharp(buf))).toEqual(expected);
  });
});
describe.skipIf(!existsSync(SAMPLE))("수업 추가 화면 캡처 (선택된 칸이 어둡고, 시간표가 중간에 잘림)", () => {
  it("요일 머리줄을 9시로 착각하지 않고, 오른쪽 바깥 여백을 토요일로 보지 않는다", async () => {
    expect(await measure(sharp(SAMPLE))).toEqual([
      "0 9-10.5", "0 13-13.5 잘림",
      "1 9-10.5", "1 13-13.5 잘림",
      "2 9-10.5",
      "3 10.5-12",
      "4 10.5-12", "4 13-13.5 잘림",
    ]);
  });
});

