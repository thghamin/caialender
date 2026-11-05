"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** 총관리자가 승인된 회원을 관리자로 임명하거나 해제한다. 권한 검사는 DB 함수(set_user_role)가 한 번 더 한다 */
export async function setMemberRole(userId: string, role: "admin" | "student"): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: role });
  if (error) return { error: error.message };
  // 관리자로 임명되면 그 회원의 휴대폰·PC로 알림 (응답은 기다리지 않는다)
  if (role === "admin" && pushConfigured()) {
    after(() =>
      sendPushToUser(userId, {
        title: "🎉 학생회 관리자로 임명됐어요",
        body: "이제 공지 등록·일정 검수, 질문 답변, 소통방 관리를 할 수 있어요. 눌러서 관리 화면을 열어 보세요.",
        url: "/admin",
        tag: `role-admin:${userId}`,
      }).catch(() => {}),
    );
  }
  revalidatePath("/admin", "layout");
  return {};
}

/** 관리자가 회원가입을 승인·거절한다. 총관리자·관리자 보호는 DB 함수(set_approval)가 검사한다 */
export async function setMemberApproval(userId: string, status: "approved" | "rejected"): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_approval", { p_user: userId, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}
