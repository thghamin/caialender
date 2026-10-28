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
  today: string;
  weekLabel: string;
  scope: string;
  events: Parameters<typeof describeEvent>[0][];
}) {
  return `너는 경북대 인공지능전공 학생에게 이번 주 일정을 알려주는 비서다. 오늘은 ${input.today}이다.
아래는 ${input.scope}의 ${input.weekLabel} 일정과 다가오는 마감이다. 이 목록에 있는 정보만 사용해 주간 브리핑을 써라.
- 첫 줄: 이번 주를 한 문장으로 요약
- 이어서 날짜순 핵심 일정 3~6개를 "• 요일 시각 — 내용" 형식으로
- 마지막 줄: 가장 급한 마감이나 준비할 것 한 가지
- 목록에 없는 일정을 만들지 말고, 일정이 없으면 "이번 주에는 등록된 일정이 없어요."라고만 써라.
- 마크다운 굵게(**)나 제목(#)은 쓰지 않는다.

[일정 목록]
${input.events.length ? input.events.map(describeEvent).join("\n") : "(없음)"}`;
}
