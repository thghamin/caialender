import { describe, expect, it } from "vitest";
import { findConflicts, overlaps } from "@/lib/conflicts";
import { pickMyEvents } from "@/lib/data/events";
import type { CalendarEvent } from "@/lib/types";

const t = (h: number, m = 0) => new Date(Date.UTC(2027, 2, 18, h - 9, m)).toISOString();

describe("시간 충돌", () => {
  const lecture = { id: "l", title: "특강", start_at: t(16), end_at: t(18) };

  it("겹치면 충돌", () => {
    expect(overlaps(lecture, { id: "p", title: "알바", start_at: t(17), end_at: t(20) })).toBe(true);
  });
  it("끝과 시작이 맞닿으면 충돌 아님", () => {
    expect(overlaps(lecture, { id: "p", title: "저녁", start_at: t(18), end_at: t(19) })).toBe(false);
  });
  it("종료 시각이 없으면 1시간으로 본다", () => {
    const noEnd = { id: "n", title: "모임", start_at: t(15, 30), end_at: null };
    expect(overlaps(noEnd, lecture)).toBe(true);
    expect(overlaps({ ...noEnd, start_at: t(14) }, lecture)).toBe(false);
  });
  it("종일 일정·마감은 시간 충돌로 보지 않는다", () => {
    const others = [
      { id: "a", title: "종일", start_at: t(9), end_at: null, all_day: true },
      { id: "d", title: "마감", start_at: t(17), end_at: null, kind: "deadline" },
      { id: "x", title: "수업", start_at: t(17), end_at: t(19) },
    ];
    expect(findConflicts(lecture, others).map((o) => o.id)).toEqual(["x"]);
  });
});

describe("내 캘린더 선별", () => {
  const ev = (id: string, target_grades: number[]) => ({ id, target_grades }) as CalendarEvent;
  const events = [ev("g1", [1]), ev("g23", [2, 3]), ev("all", []), ev("g4", [4])];

  it("내 학년 + 전체 대상 + 관심 일정", () => {
    const mine = pickMyEvents(events, { grade: 2 }, new Set(["g4"]));
    expect(mine.map((e) => [e.id, e.reason])).toEqual([
      ["g23", "grade"],
      ["all", "all"],
      ["g4", "interest"],
    ]);
  });
});
