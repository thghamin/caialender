import { describe, expect, it } from "vitest";
import { briefingItems, cleanSummary, selectBriefingEvents, weekRange } from "@/lib/briefing";
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

describe("브리핑 목록 (날짜·시각은 코드가 만든다)", () => {
  const e = (id: string, kind: CalendarEvent["kind"], start: string, end: string | null, allDay = false) =>
    ({ id, kind, title: id, location: null, all_day: allDay, start_at: new Date(`${start}+09:00`).toISOString(), end_at: end ? new Date(`${end}+09:00`).toISOString() : null }) as CalendarEvent;

  it("이미 끝난 일정(오늘 13시 마감이 지난 경우 포함)은 빼고, 시작 순서대로 정확한 시각을 쓴다", () => {
    const now = Date.UTC(2027, 2, 17, 5, 0); // 3/17(수) 14:00 KST
    const items = briefingItems(
      [
        e("오후마감", "deadline", "2027-03-17T13:00", null),
        e("총회", "event", "2027-03-19T18:00", "2027-03-19T20:00"),
        e("기간", "event", "2027-03-16T08:30", "2027-03-20T19:00"),
        e("종일", "event", "2027-03-18T00:00", "2027-03-18T00:00", true),
      ],
      now,
    );
    expect(items.map((i) => i.id)).toEqual(["기간", "종일", "총회"]);
    expect(items[0]).toMatchObject({ when: "3월 16일(화) 08:30 ~ 3월 20일(토) 19:00", ongoing: true });
    expect(items[1].when).toBe("3월 18일(목)");
    expect(items[2].when).toBe("3월 19일(금) 18:00 ~ 20:00");
  });

  it("AI 요약에 시각·날짜가 섞이면 쓰지 않는다", () => {
    expect(cleanSummary("가장 급한 마감은 오후 1시 30분이에요.")).toBeNull();
    expect(cleanSummary("13:30에 마감돼요.")).toBeNull();
    expect(cleanSummary("11월 4일에 마감돼요.")).toBeNull();
    expect(cleanSummary("**2026학년도 2학기** 박람회와 학점교류 신청 마감을 놓치지 마세요.")).toBe("2026학년도 2학기 박람회와 학점교류 신청 마감을 놓치지 마세요.");
  });
});
