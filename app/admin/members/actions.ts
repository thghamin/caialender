"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** 총관리자가 승인된 회원을 관리자로 임명하거나 해제한다. 권한 검사는 DB 함수(set_user_role)가 한 번 더 한다 */
export async function setMemberRole(userId: string, role: "admin" | "student"): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: role });
  if (error) return { error: error.message };
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
