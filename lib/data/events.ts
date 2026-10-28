import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CalendarEvent, PersonalEvent, Profile } from "@/lib/types";

const EVENT_COLUMNS =
  "id, notice_id, title, description, kind, start_at, end_at, all_day, location, target_grades, target_note, missing_fields, status, created_at, updated_at";

/** 게시된 학과 일정 전체 (비로그인도 조회 가능, AI 호출 없음) */
export async function getPublishedEvents(): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "published")
    .order("start_at");
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

/**
 * 내 캘린더 = 내 학년 대상 일정 + 전체 대상 일정 + 직접 추가한 관심 일정
 */
export function pickMyEvents(events: CalendarEvent[], profile: Pick<Profile, "grade">, interests: Set<string>): MyEvent[] {
  const mine: MyEvent[] = [];
  for (const e of events) {
    if (interests.has(e.id)) mine.push({ ...e, reason: "interest" });
    else if (profile.grade && e.target_grades.includes(profile.grade)) mine.push({ ...e, reason: "grade" });
    else if (e.target_grades.length === 0) mine.push({ ...e, reason: "all" });
  }
  return mine;
}
