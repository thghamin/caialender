import { describe, expect, it } from "vitest";
import { selectBriefingEvents, weekRange } from "@/lib/briefing";
import type { CalendarEvent } from "@/lib/types";

// 2027-03-17(수) 10:00 KST
const NOW = Date.UTC(2027, 2, 17, 1, 0);
const ev = (id: string, kind: CalendarEvent["kind"], kstIso: string) =>
  ({ id, kind, start_at: new Date(`${kstIso}+09:00`).toISOString(), end_at: null }) as CalendarEvent;

describe("주간 브리핑 범위", () => {
  it("KST 월요일 시작", () => {
    const r = weekRange(NOW);
    expect(r.weekStart).toBe("2027-03-15");
    expect(new Date(r.start).toISOString()).toBe("2027-03-14T15:00:00.000Z");
  });

  it("이번 주 일정과 2주 내 마감만 고른다", () => {
    const events = [
      ev("mon", "event", "2027-03-15T10:00"),
      ev("sun", "event", "2027-03-21T23:00"),
      ev("nextweek", "event", "2027-03-22T10:00"),
      ev("deadline10d", "deadline", "2027-03-27T23:59"),
      ev("deadline20d", "deadline", "2027-04-06T23:59"),
      ev("lastweek", "event", "2027-03-14T10:00"),
    ];
    expect(selectBriefingEvents(events, NOW).map((e) => e.id)).toEqual(["mon", "sun", "deadline10d"]);
  });
});
