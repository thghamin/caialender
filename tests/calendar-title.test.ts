import { describe, expect, it } from "vitest";
import { shortTitle } from "@/lib/calendar-title";

describe("달력 칸 짧은 제목", () => {
  it("앞의 연도·학기·회차를 떼고 핵심 단어부터", () => {
    expect(shortTitle("26-2학기 MT")).toBe("MT");
    expect(shortTitle("2026학년도 2학기 대학원 전공체험 박람회")).toBe("대학원 전공체험 박람회");
    expect(shortTitle("2026년 겨울 계절학기 서울시립대 학점교류 신청 마감")).toBe("겨울 계절학기 서울시립대 학점교류 신청 마감");
    expect(shortTitle("2026 대구 대학(원)생 AI 드래프톤")).toBe("대구 대학(원)생 AI 드래프톤");
    expect(shortTitle("2027학년도 1학기 복수전공 신청")).toBe("복수전공 신청");
    expect(shortTitle("제3회 인공지능 경진대회")).toBe("인공지능 경진대회");
  });
  it("뗄 것이 없거나 다 떼면 원래 제목", () => {
    expect(shortTitle("YBM 토익 수강생 모집")).toBe("YBM 토익 수강생 모집");
    expect(shortTitle("2026")).toBe("2026");
    expect(shortTitle("2학기")).toBe("2학기");
  });
});
