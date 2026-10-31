import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coopWeekUrl, parseCoopMenu, todayIndex, weekRange } from "@/lib/cafeteria";

// 생협 홈페이지 공학관 학생식당 주간 메뉴 페이지를 저장한 것 (공개 메뉴 정보)
const html = readFileSync("tests/fixtures/coop-menu.html", "utf8");

describe("공식당 주간 메뉴 읽기", () => {
  const menu = parseCoopMenu(html);
  it("요일·날짜, 중식·석식", () => {
    expect(menu.days.map((d) => `${d.label} ${d.date}`)).toEqual(["월 10/26", "화 10/27", "수 10/28", "목 10/29", "금 10/30", "토 10/31"]);
    expect(menu.meals.map((m) => m.meal)).toEqual(["중식", "석식"]);
  });
  it("메뉴 이름·가격, 운영시간 안내는 따로", () => {
    const mon = menu.meals[0].corners[0].days[0];
    expect(mon[0]).toEqual({ name: "육회비빔밥", price: "￦ 6,500", note: null });
    expect(mon.find((x) => x.name === "최루탄라면&밥★")).toEqual({ name: "최루탄라면&밥★", price: "￦ 4,000", note: "운영시간 10:00~14:30분" });
    expect(menu.meals[0].corners[0].corner).toBe("특식");
    expect(menu.meals[0].corners[0].days).toHaveLength(6);
  });
  it("오늘 요일 칸 (주말이 없으면 첫 칸)", () => {
    const kst = (s: string) => new Date(`${s}+09:00`).getTime();
    expect(todayIndex(menu.days, kst("2026-10-28T12:00"))).toBe(2); // 수
    expect(todayIndex(menu.days, kst("2026-11-01T12:00"))).toBe(0); // 일요일 → 첫 칸
  });
  it("이번 주·다음 주 주소는 그 주 월요일 날짜로", () => {
    const kst = (s: string) => new Date(`${s}+09:00`).getTime();
    expect(coopWeekUrl(0, kst("2026-10-31T19:00"))).toMatch(/selDate=2026-10-26$/); // 토 → 그 주 월
    expect(coopWeekUrl(1, kst("2026-10-31T19:00"))).toMatch(/selDate=2026-11-02$/);
    expect(coopWeekUrl(1, kst("2026-11-01T09:00"))).toMatch(/selDate=2026-11-02$/); // 일요일도 같은 주
    expect(coopWeekUrl(0, kst("2026-11-02T00:30"))).toMatch(/selDate=2026-11-02$/); // 월요일 새벽
  });
  it("올해 첫 주부터 다음 주까지 볼 수 있다", () => {
    const kst = (s: string) => new Date(`${s}+09:00`).getTime();
    const now = kst("2026-10-31T19:00");
    const { min, max } = weekRange(now);
    expect(max).toBe(1);
    // 2026-01-01(목)이 든 주의 월요일은 2025-12-29
    expect(coopWeekUrl(min, now)).toMatch(/selDate=2025-12-29$/);
    expect(coopWeekUrl(-30, now)).toMatch(/selDate=2026-03-30$/);
  });
});
