// 휴대폰 알림을 보낼 시각과 문구 계산 (순수 함수, 테스트 대상)
// - 내 캘린더 일정: 시작 24시간 전(종일 일정은 전날 오전 9시), 1시간 전(종일 일정은 당일 오전 8시) — 따로 켠다
// - 질문 답변: 학생회가 내 질문에 처음 답하면 바로
// - 내 시간표 수업: 매주 수업 시작 10분 전
import { formatKst } from "./datetime";
import { DAY_LABELS, hhmm, koreanTime } from "./timetable";

const MIN = 60_000;
const KST = 9 * 3600_000;
/** 작업은 1분마다 돌지만, 늦게 돌거나 한 번 놓쳐도 보내도록 이만큼 지난 알림까지 보낸다 */
export const CATCH_UP_MS = 10 * MIN;

export type ReminderEvent = { id: string; title: string; start_at: string; all_day: boolean; location: string | null };

export type LeadMinutes = 60 | 1440;
export const LEAD_LABEL: Record<LeadMinutes, string> = { 1440: "하루 전", 60: "1시간 전" };

/** 일정 알림 시각(ms). lead=1440(하루 전) 또는 60(1시간 전) */
export function eventRemindAt(e: Pick<ReminderEvent, "start_at" | "all_day">, lead: LeadMinutes = 1440) {
  const start = new Date(e.start_at).getTime();
  if (!e.all_day) return start - lead * MIN;
  // 종일 일정은 start_at이 KST 0시라서, 자는 시간을 피해 하루 전은 전날 오전 9시, 1시간 전은 당일 오전 8시에 보낸다
  return lead === 1440 ? start - 15 * 3600_000 : start + 8 * 3600_000;
}

/** now 기준으로 지금 보내야 하는가 (알림 시각이 지났고, 따라잡기 구간 안) */
export const isDue = (remindAt: number, now: number) => remindAt <= now && remindAt > now - CATCH_UP_MS;

export function eventMessage(e: ReminderEvent, kind: "event" | "personal", lead: LeadMinutes = 1440) {
  const when = formatKst(e.start_at, !e.all_day);
  return {
    title: lead === 60 ? (e.all_day ? `⏰ 오늘 일정: ${e.title}` : `⏰ 1시간 뒤 일정: ${e.title}`) : `⏰ 내일 일정: ${e.title}`,
    body: `${when}${e.location ? ` · ${e.location}` : ""}${kind === "personal" ? " (내 개인 일정)" : ""}`,
    url: kind === "event" ? `/events/${e.id}` : "/my",
    // 같은 일정이라도 시간이 바뀌면 새로 알린다
    key: `${kind}:${e.id}:${new Date(e.start_at).toISOString()}${lead === 60 ? ":60" : ""}`,
  };
}

export type ReminderSlot = { id: string; day: number; start_min: number; end_min: number; location: string | null; course_name: string };

/** 오늘(KST) 이 수업의 시작 10분 전 시각(ms). 오늘 수업이 아니면 null */
export function slotRemindAt(slot: Pick<ReminderSlot, "day" | "start_min">, now: number) {
  const kst = new Date(now + KST);
  const today = (kst.getUTCDay() + 6) % 7; // 월=0
  if (slot.day !== today) return null;
  const midnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST;
  return midnight + (slot.start_min - 10) * MIN;
}

export function slotMessage(slot: ReminderSlot, now: number) {
  const date = new Date(now + KST).toISOString().slice(0, 10);
  return {
    title: `📚 10분 뒤 수업: ${slot.course_name}`,
    body: `${DAY_LABELS[slot.day]}요일 ${koreanTime(slot.start_min)} ~ ${hhmm(slot.end_min)}${slot.location ? ` · ${slot.location}` : ""}`,
    url: "/timetable",
    key: `slot:${slot.id}:${date}`,
  };
}

/** 학생회가 내 질문에 답했을 때 */
export function answerMessage(q: { id: string; body: string; event_id: string | null }, answer: string) {
  const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
  return {
    title: "💬 학생회가 질문에 답했어요",
    body: `Q. ${cut(q.body, 40)}\nA. ${cut(answer, 80)}`,
    url: q.event_id ? `/events/${q.event_id}` : "/qna?status=answered",
    key: `answer:${q.id}`,
  };
}
