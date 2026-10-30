"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { answerMessage } from "@/lib/reminders";

export type QnaState = { error?: string; savedAt?: number } | undefined;

const askSchema = z.object({
  body: z.string().trim().min(1, "질문 내용을 입력하세요.").max(1000, "질문은 1000자까지 쓸 수 있어요."),
  event_id: z.uuid().optional().or(z.literal("")),
});

export async function askQuestion(_prev: QnaState, formData: FormData): Promise<QnaState> {
  const user = await requireUser();
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .insert({ user_id: user.id, body: parsed.data.body, event_id: parsed.data.event_id || null });
  if (error) return { error: `질문을 저장하지 못했습니다: ${error.message}` };
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

const answerSchema = z.object({
  id: z.uuid(),
  answer: z.string().trim().min(1, "답변을 입력하세요.").max(2000, "답변은 2000자까지 쓸 수 있어요."),
});

export async function answerQuestion(_prev: QnaState, formData: FormData): Promise<QnaState> {
  const admin = await requireAdmin();
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: before } = await supabase.from("questions").select("id, user_id, body, event_id, answered_at").eq("id", parsed.data.id).single();
  const { error } = await supabase
    .from("questions")
    .update({ answer: parsed.data.answer, answered_by: admin.id, answered_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: `답변을 저장하지 못했습니다: ${error.message}` };
  // 처음 답변이면 질문한 학생에게 알림 (응답을 늦추지 않도록 저장 후에 보낸다)
  if (before && !before.answered_at && before.user_id !== admin.id && pushConfigured()) {
    const msg = answerMessage(before, parsed.data.answer);
    after(async () => {
      const db = createServiceClient();
      const { error: dup } = await db.from("notification_log").insert({ user_id: before.user_id, key: msg.key });
      if (!dup) await sendPushToUser(before.user_id, { title: msg.title, body: msg.body, url: msg.url, tag: msg.key }).catch(() => {});
    });
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

/** 본인 질문(답변 전) 또는 관리자 삭제. 권한은 RLS가 판단한다 */
export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "삭제할 수 없는 질문입니다. 답변이 달린 질문은 지울 수 없어요." };
  revalidatePath("/", "layout");
  return {};
}
