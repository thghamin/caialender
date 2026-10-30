"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

const subSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** 이 기기(브라우저)를 알림 받을 기기로 등록 */
export async function savePushSubscription(sub: unknown, userAgent: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { error: "알림 구독 정보가 올바르지 않습니다." };
  const supabase = await createClient();
  // 같은 기기를 다른 계정으로 쓰다 바꾼 경우를 위해 endpoint 기준으로 덮어쓴다
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 200),
  });
  return error ? { error: error.message } : {};
}

export async function removePushSubscription(endpoint: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendTestPush(): Promise<{ error?: string; sent?: number }> {
  const user = await requireUser();
  try {
    const sent = await sendPushToUser(user.id, {
      title: "🔔 C:AI:ender 알림 테스트",
      body: "이제 이 기기로 일정 하루 전·수업 10분 전 알림이 와요.",
      url: "/my",
    });
    return sent ? { sent } : { error: "알림을 받을 기기가 없습니다. 먼저 '알림 받기'를 눌러 주세요." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** 내 캘린더 일정의 '하루 전 알림' 켜기/끄기 */
export async function toggleReminder(targetType: "event" | "personal", targetId: string, on: boolean): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(targetId).success) return { error: "잘못된 일정입니다." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("event_reminders").upsert({ user_id: user.id, target_type: targetType, target_id: targetId })
    : await supabase.from("event_reminders").delete().eq("user_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
  if (error) return { error: error.message };
  revalidatePath("/my");
  return {};
}
