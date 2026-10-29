import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKnuSchedule } from "@/lib/academic/knu-schedule";

const html = readFileSync(new URL("./fixtures/knu-schedule-2026.html", import.meta.url), "utf8");
const items = parseKnuSchedule(html, 2026);
const find = (title: string) => items.find((i) => i.title === title);

describe("경북대 학사일정 파싱", () => {
  it("페이지의 97개 일정을 모두 읽는다", () => {
    expect(items).toHaveLength(97);
    expect(new Set(items.map((i) => i.external_key)).size).toBe(97);
  });

  it("하루짜리 일정은 종료일 없이, 제목 끝 날짜 표기는 지운다", () => {
    const kaegang = items.filter((i) => i.title === "개강");
    expect(kaegang.map((i) => i.start_at)).toEqual(["2026-03-02T15:00:00.000Z", "2026-08-31T15:00:00.000Z"]);
    expect(kaegang[0].end_at).toBeNull();
  });

  it("기간 표기에서 종료일을 계산한다", () => {
    const sugang = items.find((i) => i.title === "1학기 수강신청")!;
    expect(sugang.start_at).toBe("2026-02-09T15:00:00.000Z");
    expect(sugang.end_at).toBe("2026-02-11T15:00:00.000Z");
    // "(4.16. ~ 4.22.)" 처럼 공백이 있어도
    expect(items.find((i) => i.title === "중간고사 기간" && i.start_at.startsWith("2026-04"))!.end_at).toBe(
      "2026-04-21T15:00:00.000Z",
    );
    // 달을 넘기는 기간
    expect(items.find((i) => i.title === "대학원 종합시험 시행" && i.start_at.startsWith("2026-08"))!.end_at).toBe(
      "2026-08-31T15:00:00.000Z",
    );
    // 해를 넘기는 기간 "12.28.~2027.1.5."
    expect(items.find((i) => i.title === "대학원 원문파일 접수" && i.start_at.startsWith("2026-12"))!.end_at).toBe(
      "2027-01-04T15:00:00.000Z",
    );
  });

  it("대학원 일정과 종류를 구분한다", () => {
    const grad = items.filter((i) => i.target_note === "대학원");
    expect(grad.length).toBeGreaterThan(20);
    expect(grad.every((i) => i.title.startsWith("대학원 "))).toBe(true);
    expect(find("한글날")?.kind).toBe("other");
    expect(find("복학원 접수종료")?.kind).toBe("deadline");
    expect(find("2학기 수강신청")?.kind).toBe("event");
  });
});
