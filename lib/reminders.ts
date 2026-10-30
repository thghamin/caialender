// 휴대폰 알림을 보낼 시각과 문구 계산 (순수 함수, 테스트 대상)
// - 내 캘린더 일정: 시작 24시간 전 (종일 일정은 시작 전날 오전 9시)
// - 내 시간표 수업: 매주 수업 시작 10분 전
import { formatKst } from "./datetime";
import { DAY_LABELS, hhmm, koreanTime } from "./timetable";

const MIN = 60_000;
const KST = 9 * 3600_000;
/** 작업은 1분마다 돌지만, 늦게 돌거나 한 번 놓쳐도 보내도록 이만큼 지난 알림까지 보낸다 */
export const CATCH_UP_MS = 10 * MIN;

export type ReminderEvent = { id: string; title: string; start_at: string; all_day: boolean; location: string | null };

/** 일정 알림 시각(ms) */
export function eventRemindAt(e: Pick<ReminderEvent, "start_at" | "all_day">) {
  const start = new Date(e.start_at).getTime();
  if (!e.all_day) return start - 24 * 3600_000;
  // 종일 일정은 start_at이 KST 0시이므로, 전날 0시가 아니라 전날 오전 9시에 보낸다
  return start - 24 * 3600_000 + 9 * 3600_000;
}

/** now 기준으로 지금 보내야 하는가 (알림 시각이 지났고, 따라잡기 구간 안) */
export const isDue = (remindAt: number, now: number) => remindAt <= now && remindAt > now - CATCH_UP_MS;

export function eventMessage(e: ReminderEvent, kind: "event" | "personal") {
  const when = formatKst(e.start_at, !e.all_day);
  return {
    title: `⏰ 내일 일정: ${e.title}`,
    body: `${when}${e.location ? ` · ${e.location}` : ""}${kind === "personal" ? " (내 개인 일정)" : ""}`,
    url: kind === "event" ? `/events/${e.id}` : "/my",
    // 같은 일정이라도 시간이 바뀌면 새로 알린다
    key: `${kind}:${e.id}:${new Date(e.start_at).toISOString()}`,
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
