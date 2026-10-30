import { describe, expect, it } from "vitest";
import { gridRange, normalizeTimetable, parseHhmm } from "@/lib/timetable";
import { eventMessage, eventRemindAt, isDue, slotMessage, slotRemindAt } from "@/lib/reminders";

const kst = (s: string) => new Date(`${s}+09:00`).getTime();

describe("시간표 AI 결과 정규화", () => {
  it("요일·시각을 해석하고 같은 과목의 칸을 합친다", () => {
    const { courses, dropped } = normalizeTimetable({
      courses: [
        { name: "동역학", professor: "이재욱", slots: [{ day: "월", start: "09:00", end: "10:15", location: "복현회관-308" }] },
        { name: "동역학", professor: "이재욱", slots: [{ day: "수", start: "9:00", end: "10:15", location: "복현회관-308" }] },
        { name: "로봇제어1", professor: null, slots: [{ day: "화", start: "09:02", end: "10:00", location: null }] },
        { name: "이상한칸", professor: null, slots: [{ day: "X", start: "25:00", end: "10:00", location: null }] },
      ],
    });
    expect(courses).toHaveLength(2);
    expect(courses[0].slots.map((s) => [s.day, s.start_min, s.end_min])).toEqual([
      [0, 540, 615],
      [2, 540, 615],
    ]);
    expect(courses[1].slots[0].start_min).toBe(540); // 9:02 → 5분 단위 반올림
    expect(dropped).toEqual(["이상한칸: 시간 해석 실패"]);
  });

  it("주말 수업이 있으면 그리드에 토·일을 넣고, 시간 범위를 넓힌다", () => {
    expect(gridRange([])).toEqual({ days: 5, startHour: 9, endHour: 18 });
    expect(gridRange([{ slots: [{ day: 5, start_min: 480, end_min: 1260, location: null }] }])).toEqual({
      days: 6,
      startHour: 8,
      endHour: 21,
    });
    expect(parseHhmm("13:07")).toBe(785);
  });
});

describe("알림 시각", () => {
  const ev = { id: "e1", title: "MT", start_at: new Date(kst("2026-11-05T18:00")).toISOString(), all_day: false, location: "강당" };

  it("일정은 시작 24시간 전, 종일 일정은 전날 오전 9시", () => {
    expect(eventRemindAt(ev)).toBe(kst("2026-11-04T18:00"));
    const allDay = { ...ev, start_at: new Date(kst("2026-11-05T00:00")).toISOString(), all_day: true };
    expect(eventRemindAt(allDay)).toBe(kst("2026-11-04T09:00"));
  });

  it("알림 시각이 지난 직후(10분 이내)에만 보낸다", () => {
    const at = eventRemindAt(ev);
    expect(isDue(at, at - 60_000)).toBe(false);
    expect(isDue(at, at)).toBe(true);
    expect(isDue(at, at + 9 * 60_000)).toBe(true);
    expect(isDue(at, at + 11 * 60_000)).toBe(false);
  });

  it("시간표 수업은 그 요일에만, 시작 10분 전", () => {
    const slot = { id: "s1", day: 2, start_min: 9 * 60, end_min: 10 * 60 + 15, location: "복현회관-308", course_name: "동역학" };
    const wednesday = kst("2026-11-04T08:51"); // 2026-11-04는 수요일
    expect(slotRemindAt(slot, wednesday)).toBe(kst("2026-11-04T08:50"));
    expect(slotRemindAt(slot, kst("2026-11-05T08:51"))).toBeNull();
    expect(slotMessage(slot, wednesday)).toMatchObject({
      title: "📚 10분 뒤 수업: 동역학",
      body: "수요일 오전 9:00 ~ 10:15 · 복현회관-308",
      key: "slot:s1:2026-11-04",
    });
  });

  it("알림 문구", () => {
    expect(eventMessage(ev, "event")).toMatchObject({ title: "⏰ 내일 일정: MT", url: "/events/e1" });
    expect(eventMessage(ev, "personal").body).toContain("(내 개인 일정)");
  });
});
