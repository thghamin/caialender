import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
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
  it("모든 수업 칸의 요일·시각을 30분 단위로 정확히 잰다", async () => {
    const { data, info } = await sharp(FULL).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
