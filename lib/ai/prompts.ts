// 주간 브리핑 프롬프트 (순수 함수)
import { formatKst } from "../datetime";
import { KIND_LABEL, type CalendarEvent } from "../types";

export function describeEvent(e: Pick<CalendarEvent, "title" | "kind" | "start_at" | "end_at" | "all_day" | "location" | "target_grades" | "target_note" | "description">) {
  const when = e.end_at
    ? `${formatKst(e.start_at, !e.all_day)} ~ ${formatKst(e.end_at, !e.all_day)}`
    : formatKst(e.start_at, !e.all_day);
  const target = e.target_grades.length ? `${e.target_grades.join("·")}학년` : "전체";
  return `- [${KIND_LABEL[e.kind]}] ${e.title} | ${when} | 장소: ${e.location ?? "공지에 없음"} | 대상: ${target}${e.target_note ? ` (${e.target_note})` : ""}${e.description ? ` | ${e.description}` : ""}`;
}

export function buildBriefingPrompt(input: {
  now: string;
  weekLabel: string;
  scope: string;
  events: Parameters<typeof describeEvent>[0][];
}) {
  // 날짜·시각이 들어간 일정 목록은 화면에서 코드가 정확히 그려 준다. AI는 '흐름 요약'만 쓴다
  // (AI가 시각을 옮겨 적다가 13:00을 13:30으로 바꾸는 실수를 막기 위해)
  const lines = input.events.map((e) => describeEvent(e));
  return `너는 경북대 인공지능전공 학생에게 이번 주 일정을 알려주는 비서다. 지금은 ${formatKst(input.now)}이다.
아래는 ${input.scope}의 ${input.weekLabel} 남은 일정과 다가오는 마감 목록이다. 이 목록만 보고 이번 주 흐름을 1~2문장으로 요약하라.
- 날짜·요일·시각·숫자(예: 11월 4일, 13:00, 1시)는 절대 쓰지 마라. 날짜는 화면의 목록이 따로 보여 준다.
- 일정 제목은 그대로 쓰되 너무 길면 핵심만 짧게 줄여도 된다. 목록에 없는 일정이나 정보를 만들지 마라.
- 마감이 있으면 '놓치지 말 것'처럼 챙겨야 할 점을 짚어 준다.
- 마크다운 굵게(**), 제목(#), 글머리표(•, -)는 쓰지 않는다. 존댓말(~해요)로 쓴다.

[일정 목록]
${lines.length ? lines.join("\n") : "(없음)"}`;
}
