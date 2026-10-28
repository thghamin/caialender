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
  const now = new Date(input.now).getTime();
  // 모델이 날짜 계산을 틀리지 않도록 '지남/진행 중/예정'을 코드에서 미리 계산해 준다
  const lines = input.events.map((e) => {
    const start = new Date(e.start_at).getTime();
    const end = new Date(e.end_at ?? e.start_at).getTime() + (e.all_day ? 86400_000 : 0);
    const state = end < now ? "지난 일정" : start <= now ? "진행 중" : "예정";
    return `${describeEvent(e)} | 상태: ${state}`;
  });
  return `너는 경북대 인공지능전공 학생에게 이번 주 일정을 알려주는 비서다. 지금은 ${formatKst(input.now)}이다.
아래는 ${input.scope}의 ${input.weekLabel} 일정과 다가오는 마감 목록이다. 이 목록의 정보만 사용해 주간 브리핑을 써라.
- 첫 줄: 이번 주를 한 문장으로 요약 (각 일정의 '상태'를 그대로 따를 것. '예정'인 일정을 끝났다고 쓰지 마라)
- 이어서 목록의 '예정'과 '진행 중' 일정을 날짜순으로 빠짐없이, 일정 하나당 한 줄 "• 날짜(요일) 시각 — 제목 (장소)" 형식으로. 시작~종료는 한 줄에 함께 쓴다.
- 마지막 줄: 가장 급한 마감이나 준비할 것 한 가지
- 목록에 없는 일정이나 정보를 만들지 마라. 예정 일정이 없으면 "이번 주에는 남은 일정이 없어요."라고만 써라.
- 마크다운 굵게(**)나 제목(#)은 쓰지 않는다.

[일정 목록]
${lines.length ? lines.join("\n") : "(없음)"}`;
}
