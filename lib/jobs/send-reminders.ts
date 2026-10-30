import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser, pushConfigured } from "@/lib/push";
import { CATCH_UP_MS, eventMessage, eventRemindAt, isDue, slotMessage, slotRemindAt, type LeadMinutes, type ReminderEvent } from "@/lib/reminders";

const DAY = 86400_000;

/**
 * 지금 보낼 알림을 찾아 휴대폰으로 보낸다. 예약 작업(pg_cron)이 1분마다 호출한다.
 * - 켜 둔 내 캘린더 일정: 시작 24시간 전·1시간 전 (각각 따로 켠다)
 * - 알림을 켠 시간표 수업: 시작 10분 전
 * notification_log로 같은 알림을 두 번 보내지 않는다.
 */
export async function sendDueReminders(now = Date.now()) {
  if (!pushConfigured()) return { sent: 0, skipped: "VAPID 키 없음" };
  const db = createServiceClient();
  const due: { userId: string; msg: ReturnType<typeof eventMessage> }[] = [];

  // 1) 일정 알림: 알림 시각이 [now-따라잡기, now] 안인 일정 = 시작이 대략 now+24h 근처
  const { data: reminders } = await db.from("event_reminders").select("user_id, target_type, target_id, lead_minutes");
  const eventIds = [...new Set((reminders ?? []).filter((r) => r.target_type === "event").map((r) => r.target_id))];
  const personalIds = [...new Set((reminders ?? []).filter((r) => r.target_type === "personal").map((r) => r.target_id))];
  const windowFrom = new Date(now - CATCH_UP_MS).toISOString();
  const windowTo = new Date(now + 2 * DAY).toISOString();
  const [{ data: events }, { data: personal }] = await Promise.all([
    eventIds.length
      ? db.from("events").select("id, title, start_at, all_day, location").in("id", eventIds).eq("status", "published").gte("start_at", windowFrom).lte("start_at", windowTo)
      : Promise.resolve({ data: [] as ReminderEvent[] }),
    personalIds.length
      ? db.from("personal_events").select("id, title, start_at").in("id", personalIds).gte("start_at", windowFrom).lte("start_at", windowTo)
      : Promise.resolve({ data: [] as { id: string; title: string; start_at: string }[] }),
  ]);
  const byId = new Map<string, { e: ReminderEvent; kind: "event" | "personal" }>();
  for (const e of events ?? []) byId.set(`event:${e.id}`, { e: e as ReminderEvent, kind: "event" });
  for (const p of personal ?? []) byId.set(`personal:${p.id}`, { e: { ...p, all_day: false, location: null }, kind: "personal" });
  for (const r of reminders ?? []) {
    const hit = byId.get(`${r.target_type}:${r.target_id}`);
    const lead = (r.lead_minutes === 60 ? 60 : 1440) as LeadMinutes;
    if (hit && isDue(eventRemindAt(hit.e, lead), now)) due.push({ userId: r.user_id, msg: eventMessage(hit.e, hit.kind, lead) });
  }

  // 2) 시간표 수업 알림
  const { data: slots } = await db
    .from("timetable_slots")
    .select("id, user_id, day, start_min, end_min, location, course:timetable_courses!inner(name, reminder)")
    .eq("course.reminder", true);
  for (const s of (slots ?? []) as unknown as {
    id: string; user_id: string; day: number; start_min: number; end_min: number; location: string | null; course: { name: string };
  }[]) {
    const at = slotRemindAt(s, now);
    if (at !== null && isDue(at, now)) due.push({ userId: s.user_id, msg: slotMessage({ ...s, course_name: s.course.name }, now) });
  }

  // 3) 보내기 (기록을 먼저 남겨 두 번 보내지 않는다)
  let sent = 0;
  for (const d of due) {
    const { error } = await db.from("notification_log").insert({ user_id: d.userId, key: d.msg.key });
    if (error) continue; // 이미 보낸 알림 (primary key 중복)
    sent += await sendPushToUser(d.userId, { title: d.msg.title, body: d.msg.body, url: d.msg.url, tag: d.msg.key });
  }
  return { sent, due: due.length };
}
