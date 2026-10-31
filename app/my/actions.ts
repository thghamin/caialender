"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kstToIso } from "@/lib/datetime";
import { findConflicts } from "@/lib/conflicts";
import { getInterestIds, getPersonalEvents, getPublishedEvents, pickMyEvents } from "@/lib/data/events";

export async function toggleInterest(eventId: string, add: boolean) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = add
    ? await supabase.from("user_events").upsert({ user_id: user.id, event_id: eventId })
    : await supabase.from("user_events").delete().eq("user_id", user.id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
  // 학과·학사·내 캘린더와 일정 상세의 ★ 표시를 모두 갱신
  revalidatePath("/", "layout");
}

export type PersonalState =
  | {
      error?: string;
      savedAt?: number;
      conflicts?: { title: string; start_at: string }[];
      /** React 19는 액션 후 폼을 비우므로, 다시 보여줄 입력값을 돌려준다 */
      values?: { title: string; start: string; end: string };
    }
  | undefined;

const personalSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요.").max(100),
  start: z.string().min(1, "시작 시각을 입력하세요."),
  end: z.string().min(1, "종료 시각을 입력하세요."),
  memo: z.string().max(500).optional().default(""),
  force: z.string().optional(),
});

/** 개인 일정 추가. 내 캘린더의 학과 일정·개인 일정과 겹치면 먼저 경고하고, 확인하면 저장한다 */
export async function addPersonalEvent(_prev: PersonalState, formData: FormData): Promise<PersonalState> {
  const user = await requireUser();
  const values = {
    title: String(formData.get("title") ?? ""),
    start: String(formData.get("start") ?? ""),
    end: String(formData.get("end") ?? ""),
  };
  const parsed = personalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const start = kstToIso(parsed.data.start);
  const end = kstToIso(parsed.data.end);
  if (!start?.hasTime || !end?.hasTime) return { error: "시각 형식이 올바르지 않습니다.", values };
  if (end.iso <= start.iso) return { error: "종료 시각이 시작 시각보다 늦어야 합니다.", values };

  const candidate = { id: "new", title: parsed.data.title, start_at: start.iso, end_at: end.iso };
  if (!parsed.data.force) {
    const [events, interests, personal] = await Promise.all([
      getPublishedEvents(),
      getInterestIds(user.id),
      getPersonalEvents(user.id),
    ]);
    const conflicts = findConflicts(candidate, [...pickMyEvents(events, interests), ...personal]);
    if (conflicts.length) {
      return { conflicts: conflicts.map((c) => ({ title: c.title, start_at: c.start_at })), values };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("personal_events").insert({
    user_id: user.id,
    title: parsed.data.title,
    start_at: start.iso,
    end_at: end.iso,
    memo: parsed.data.memo,
  });
  if (error) return { error: `저장 실패: ${error.message}`, values };
  revalidatePath("/my");
  return { savedAt: Date.now() };
}

export async function deletePersonalEvent(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("personal_events").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/my");
}
