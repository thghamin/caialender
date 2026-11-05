"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUser } from "@/lib/push";

const schema = z.object({
  body: z.string().trim().min(2, "의견을 2자 이상 적어 주세요.").max(1000, "의견은 1000자까지 쓸 수 있어요."),
  page: z.string().max(200).optional(),
});

/** 베타 의견 보내기: 학생회(관리자)만 볼 수 있게 저장하고 관리자에게 알림 */
export async function sendFeedback(input: { body: string; page?: string }): Promise<{ error?: string }> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback").insert({ body: parsed.data.body, page: parsed.data.page ?? null }).select("id").single();
  if (error) return { error: "의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  if (pushConfigured()) {
    after(async () => {
      const db = createServiceClient();
      const { data: admins } = await db.from("profiles").select("id").in("role", ["admin", "super_admin"]).eq("approval_status", "approved");
      const msg = { title: "💬 새 베타 의견", body: parsed.data.body.slice(0, 80), url: "/admin/feedback", tag: `feedback:${data.id}` };
      await Promise.all((admins ?? []).map((a) => sendPushToUser(a.id, msg).catch(() => {})));
    });
  }
  revalidatePath("/admin", "layout");
  return {};
}

/** 관리자: 의견을 확인함으로 표시하거나 되돌린다 */
export async function setFeedbackHandled(id: string, handled: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").update({ handled }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}
