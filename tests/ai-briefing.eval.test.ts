/**
 * 실제 AI로 주간 브리핑 품질을 확인하는 평가 테스트 (AI_EVAL=1 일 때만 실행)
 *   AI_EVAL=1 node --env-file=.env.local node_modules/.bin/vitest run tests/ai-briefing.eval.test.ts
 */
import { describe, expect, it } from "vitest";
import { generateText } from "@/lib/ai/provider";
import { buildBriefingPrompt } from "@/lib/ai/prompts";
import { cleanSummary } from "@/lib/briefing";
import type { CalendarEvent } from "@/lib/types";

const run = process.env.AI_EVAL === "1" ? describe : describe.skip;
const ev = (title: string, kind: CalendarEvent["kind"], start: string, end: string | null, location: string | null = null) =>
  ({
    title, kind, location, all_day: false, target_grades: [], target_note: null, description: "",
    start_at: new Date(`${start}+09:00`).toISOString(),
    end_at: end ? new Date(`${end}+09:00`).toISOString() : null,
  }) as unknown as CalendarEvent;

run("AI 주간 브리핑 평가", () => {
  it("흐름 요약 1~2문장: 날짜·시각 숫자를 쓰지 않는다 (목록은 코드가 그린다)", async () => {
    const events = [
      ev("동아리 박람회", "event", "2027-03-15T12:00", "2027-03-15T17:00", "일청담"),
      ev("새내기 배움터", "event", "2027-03-18T09:00", "2027-03-18T18:00", "IT-5호관"),
      ev("2학년 전공 설명회", "event", "2027-03-19T16:00", "2027-03-19T18:00"),
      ev("학과 총회", "event", "2027-03-20T18:00", "2027-03-20T20:00", "대강당"),
      ev("장학금 신청 마감", "deadline", "2027-03-24T23:59", null),
    ];
    const t0 = Date.now();
    const { text, model } = await generateText({
      messages: [{ role: "user", content: buildBriefingPrompt({ now: "2027-03-17T01:00:00.000Z", weekLabel: "이번 주", scope: "전체 캘린더", events }) }],
      maxTokens: 700,
    });
    console.log(`[${model}] ${((Date.now() - t0) / 1000).toFixed(1)}s\n${text}`);
    expect(cleanSummary(text)).not.toBeNull();
    expect(text).not.toContain("공지에 없음");
  }, 120_000);
});
