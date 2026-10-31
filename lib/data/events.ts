import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CalendarEvent, CalendarKind, PersonalEvent, Profile } from "@/lib/types";

const EVENT_COLUMNS =
  "id, notice_id, calendar, title, description, kind, start_at, end_at, all_day, location, target_grades, target_note, missing_fields, evidence, status, created_at, updated_at";

/** 게시된 일정 (비로그인도 조회 가능, AI 호출 없음). calendar를 주면 그 캘린더만 */
export async function getPublishedEvents(calendar?: CalendarKind): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase.from("events").select(EVENT_COLUMNS).eq("status", "published");
  if (calendar) query = query.eq("calendar", calendar);
  const { data, error } = await query.order("start_at");
  if (error) throw new Error(`일정을 불러오지 못했습니다: ${error.message}`);
  return data as CalendarEvent[];
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  return (data as CalendarEvent | null) ?? null;
}

export async function getInterestIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_events").select("event_id").eq("user_id", userId);
  if (error) throw new Error(`관심 일정을 불러오지 못했습니다: ${error.message}`);
  return new Set(data.map((r) => r.event_id as string));
}

export async function getPersonalEvents(userId: string): Promise<PersonalEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_events")
    .select("id, user_id, title, start_at, end_at, memo")
    .eq("user_id", userId)
    .order("start_at");
  if (error) throw new Error(`개인 일정을 불러오지 못했습니다: ${error.message}`);
  return data as PersonalEvent[];
}

export type MyEvent = CalendarEvent & { reason: "grade" | "all" | "interest" };

/** 내 캘린더 = 내가 ☆로 직접 담은 일정만 (학과·학사). 아무것도 담지 않으면 비어 있다 */
export function pickMyEvents(events: CalendarEvent[], interests: Set<string>): MyEvent[] {
  return events.filter((e) => interests.has(e.id)).map((e) => ({ ...e, reason: "interest" as const }));
}

/**
 * 나와 관련 있는 일정 (AI 개인 브리핑용): 직접 담은 일정 + 내 학년·전체 대상 학과 일정.
 * 내 캘린더에 자동으로 넣지는 않고, 브리핑이 '놓치기 쉬운 내 학년 일정'까지 알려 주는 데만 쓴다.
 */
export function pickRelevantEvents(events: CalendarEvent[], profile: Pick<Profile, "grade">, interests: Set<string>): MyEvent[] {
  const mine: MyEvent[] = [];
  for (const e of events) {
    if (interests.has(e.id)) mine.push({ ...e, reason: "interest" });
    else if (e.calendar === "academic") continue;
    else if (profile.grade && e.target_grades.includes(profile.grade)) mine.push({ ...e, reason: "grade" });
    else if (e.target_grades.length === 0) mine.push({ ...e, reason: "all" });
  }
  return mine;
}

/** 알림을 켠 일정 키 집합: "event:<id>:1440"(하루 전) / "personal:<id>:60"(1시간 전) … */
export async function getReminderKeys(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_reminders").select("target_type, target_id, lead_minutes").eq("user_id", userId);
  if (error) throw new Error(`알림 설정을 불러오지 못했습니다: ${error.message}`);
  return new Set(data.map((r) => `${r.target_type}:${r.target_id}:${r.lead_minutes}`));
}
