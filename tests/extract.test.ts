import { describe, expect, it } from "vitest";
import { normalizeExtraction } from "@/lib/ai/extract-schema";
import { diffEvent, summarizeChanges } from "@/lib/ai/change-detect";
import { formatKst, kstDate, kstToIso } from "@/lib/datetime";

describe("kstToIso", () => {
  it("날짜만 있으면 KST 자정", () => {
    expect(kstToIso("2027-02-13")).toEqual({ iso: "2027-02-12T15:00:00.000Z", hasTime: false });
  });
  it("시각이 있으면 KST 기준", () => {
    expect(kstToIso("2027-02-24T09:00")).toEqual({ iso: "2027-02-24T00:00:00.000Z", hasTime: true });
    expect(kstToIso("2027-02-24T09:00:00")?.iso).toBe("2027-02-24T00:00:00.000Z");
  });
  it("잘못된 형식은 null", () => {
    expect(kstToIso("2월 24일")).toBeNull();
    expect(kstToIso("")).toBeNull();
    expect(kstToIso(null)).toBeNull();
  });
  it("표시 형식", () => {
    expect(formatKst("2027-02-24T00:00:00.000Z")).toBe("2월 24일(수) 09:00");
    expect(kstDate("2027-02-12T15:00:00.000Z")).toBe("2027-02-13");
  });
});

describe("normalizeExtraction", () => {
  const base = {
    title: "새내기 배움터",
    kind: "event",
    start: "2027-02-24T09:00",
    end: "2027-02-25",
    location: "경주 블루원 리조트",
    target_grades: [1],
    target_note: "27학번 신입생",
    description: "1박 2일",
    missing_fields: ["시간"],
    existing_event_id: null,
  };

  it("정상 항목을 정규화하고 시각이 있으면 '시간' 누락을 지운다", () => {
    const { events, dropped } = normalizeExtraction({ events: [base] });
    expect(dropped).toEqual([]);
    expect(events[0]).toMatchObject({
      title: "새내기 배움터",
      kind: "event",
      start_at: "2027-02-24T00:00:00.000Z",
      end_at: "2027-02-25T14:59:00.000Z",
      all_day: false,
      target_grades: [1],
      missing_fields: [],
    });
  });

  it("날짜를 해석할 수 없는 항목은 버리고 이유를 남긴다", () => {
    const { events, dropped } = normalizeExtraction({ events: [{ ...base, start: "미정" }] });
    expect(events).toHaveLength(0);
    expect(dropped[0]).toContain("날짜 해석 실패");
  });

  it("잘못된 학년, 알 수 없는 kind, 시작보다 이른 end를 정리한다", () => {
    const { events } = normalizeExtraction({
      events: [{ ...base, kind: "party", target_grades: [0, 2, 2, 5, 3], end: "2027-01-01" }],
    });
    expect(events[0]).toMatchObject({ kind: "other", target_grades: [2, 3], end_at: null });
  });

  it("대상 설명에 학년 표현이 없으면 AI가 지정한 학년을 무시한다", () => {
    const { events } = normalizeExtraction({
      events: [
        { ...base, target_grades: [2, 3, 4], target_note: "6단대 재적생" },
        { ...base, target_grades: [1], target_note: "27학번 신입생" },
        { ...base, target_grades: [2, 3, 4], target_note: "인공지능전공 2~4학년" },
        { ...base, target_grades: [1], target_note: null },
      ],
    });
    expect(events.map((e) => e.target_grades)).toEqual([[], [1], [2, 3, 4], [1]]);
  });

  it("게시일보다 한참 전 날짜는 다음 해로 보정한다 (연도 없는 날짜 오해석)", () => {
    const posted = "2026-10-29T01:00:00.000Z";
    const { events } = normalizeExtraction(
      {
        events: [
          { ...base, start: "2026-03-18T16:00", end: "2026-03-18T18:00" },
          { ...base, start: "2026-09-30T23:59", end: null },
          { ...base, start: "2026-11-02", end: null },
        ],
      },
      new Set(),
      posted,
    );
    expect(events.map((e) => e.start_at)).toEqual([
      "2027-03-18T07:00:00.000Z",
      "2026-09-30T14:59:00.000Z",
      "2026-11-01T15:00:00.000Z",
    ]);
    expect(events[0].end_at).toBe("2027-03-18T09:00:00.000Z");
  });

  it("목록에 없는 existing_event_id는 무시한다 (AI 환각 방지)", () => {
    const known = new Set(["a1"]);
    const { events } = normalizeExtraction(
      { events: [{ ...base, existing_event_id: "a1" }, { ...base, existing_event_id: "zzz" }] },
      known,
    );
    expect(events.map((e) => e.existing_event_id)).toEqual(["a1", null]);
  });

  it("형식이 완전히 틀리면 빈 결과", () => {
    expect(normalizeExtraction("nope").events).toEqual([]);
    expect(normalizeExtraction({ events: [{ foo: 1 }] }).dropped).toEqual(["필수 항목 누락"]);
  });
});

describe("diffEvent", () => {
  const before = {
    title: "현직자 특강",
    start_at: "2027-03-18T07:00:00.000Z",
    end_at: "2027-03-18T09:00:00.000Z",
    all_day: false,
    location: "IT-5호관 224호",
    target_grades: [2, 3, 4],
    description: "",
  };

  it("바뀐 것이 없으면 빈 배열", () => {
    expect(diffEvent(before, { ...before })).toEqual([]);
  });

  it("장소 변경을 감지한다", () => {
    const changes = diffEvent(before, { ...before, location: "IT-5호관 345호" });
    expect(changes).toEqual([{ field: "location", before: "IT-5호관 224호", after: "IT-5호관 345호" }]);
    expect(summarizeChanges("현직자 특강", changes)).toBe("「현직자 특강」 장소: IT-5호관 224호 → IT-5호관 345호");
  });

  it("일시 변경을 감지한다", () => {
    const changes = diffEvent(before, { ...before, start_at: "2027-03-19T07:00:00.000Z" });
    expect(changes.map((c) => c.field)).toEqual(["start_at"]);
  });

  it("새 공지가 날짜만 언급하고 같은 날이면 변경이 아니다", () => {
    const after = { ...before, all_day: true, start_at: "2027-03-17T15:00:00.000Z", end_at: null };
    expect(diffEvent(before, after)).toEqual([]);
  });

  it("새 공지에 장소가 없으면(null) 삭제로 보지 않는다", () => {
    expect(diffEvent(before, { ...before, location: null })).toEqual([]);
  });
});

describe("AI 근거 문장", () => {
  it("근거 문장을 저장하고, 공지 본문에서 위치를 찾는다 (줄바꿈·공백 차이 무시)", async () => {
    const { normalizeExtraction, findEvidence } = await import("@/lib/ai/extract-schema");
    const { events } = normalizeExtraction({
      events: [{ title: "MT", kind: "event", start: "2027-03-05", end: null, location: null, target_grades: [], target_note: null, description: "", missing_fields: [], existing_event_id: null, evidence: "  MT는 3/5(금) 강당 집결  " }],
    });
    expect(events[0].evidence).toBe("MT는 3/5(금) 강당 집결");
    const body = "안내드립니다.\nMT는 3/5(금)\n강당 집결입니다.";
    const hit = findEvidence(body, events[0].evidence)!;
    expect(body.slice(hit.start, hit.end)).toBe("MT는 3/5(금)\n강당 집결");
    expect(findEvidence(body, "없는 문장")).toBeNull();
  });
});

describe("기존 일정 연결 확인 (변경 탐지 오탐 방지)", () => {
  it("같은 행사면 연결, 전혀 다른 행사면 연결하지 않는다", async () => {
    const { sameEventTitle } = await import("@/lib/ai/extract-schema");
    expect(sameEventTitle("26-2학기 MT", "MT 장소 변경")).toBe(true);
    expect(sameEventTitle("2027 AI전공 현직자 초청 특강", "현직자 특강 일정 변경")).toBe(true);
    expect(sameEventTitle("새내기 배움터", "새내기 배움터 신청 마감")).toBe(true);
    expect(sameEventTitle("26-2학기 MT", "새내기 배움터")).toBe(false);
    expect(sameEventTitle("26-2학기 MT", "E2E3-abc 새내기 배움터")).toBe(false);
    expect(sameEventTitle("중간고사 간식마차", "학과 체육대회")).toBe(false);
  });
});

describe("추출 결과 자체 점검", () => {
  it("마감·행사 본 일정이 빠졌는지 알아챈다", async () => {
    const { extractionGap } = await import("@/lib/ai/extract-schema");
    const ev = (kind: "event" | "deadline", description = "") => ({ kind, description, evidence: null });
    expect(extractionGap([ev("event", "QR로 3/15까지 신청")], "")).toContain("마감");
    expect(extractionGap([ev("deadline")], "일시: 11/24 집결 IT-5호관")).toContain("행사 본 일정");
    expect(extractionGap([ev("event"), ev("deadline")], "신청 ~3/15")).toBeNull();
    expect(extractionGap([ev("event", "특강")], "3월 18일 특강")).toBeNull();
  });
});
