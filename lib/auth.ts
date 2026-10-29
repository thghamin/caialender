import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { isAdminRole, type Profile } from "./types";

/**
 * 현재 로그인 사용자 id. JWT를 공개키로 로컬 검증하므로(getClaims) Auth 서버 왕복이 없다.
 * 데이터 접근 권한은 이 JWT로 DB의 RLS가 다시 검사한다.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/** 현재 로그인 사용자와 프로필. 비로그인이면 null */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, student_no, grade, department, role, approval_status")
    .eq("id", userId)
    .single();
  return (profile as Profile | null) ?? null;
});

/** 로그인만 확인 (승인 대기 안내 화면용) */
export async function requireSignedIn(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 서비스 이용: 로그인 + 관리자 승인 완료. 승인 전이면 안내 화면으로 보낸다 */
export async function requireUser(): Promise<Profile> {
  const user = await requireSignedIn();
  if (user.approval_status !== "approved") redirect("/pending");
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) redirect("/");
  return user;
}

/** 총관리자: 관리자 임명·해제 */
export async function requireSuperAdmin(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/");
  return user;
}
