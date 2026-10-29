import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Question = {
  id: string;
  user_id: string;
  event_id: string | null;
  body: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  event: { id: string; title: string } | null;
  /** 다른 학생의 이름은 profiles RLS로 가려져 null (관리자와 본인만 보임) */
  author: { name: string; grade: number | null } | null;
};

const COLUMNS =
  "id, user_id, event_id, body, answer, answered_at, created_at, event:events(id, title), author:profiles!questions_user_id_fkey(name, grade)";

export async function getQuestions(opts: { status?: "pending" | "answered"; eventId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("questions").select(COLUMNS).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status === "pending") query = query.is("answered_at", null);
  if (opts.status === "answered") query = query.not("answered_at", "is", null);
  if (opts.eventId) query = query.eq("event_id", opts.eventId);
  const { data, error } = await query;
  if (error) throw new Error(`질문을 불러오지 못했습니다: ${error.message}`);
  return data as unknown as Question[];
}

export async function countPendingQuestions() {
  const supabase = await createClient();
  const { count } = await supabase.from("questions").select("*", { count: "exact", head: true }).is("answered_at", null);
  return count ?? 0;
}
