"use server";

import { createClient } from "@/lib/supabase/server";

/** 처음 둘러보기를 끝냈거나 그만 보기를 눌렀다: 계정에 기록해서 다른 기기에서도 다시 띄우지 않는다 */
export async function markTourDone(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { tour_done: true } });
  if (error) return;
  // 새 기록이 담긴 로그인 토큰으로 바로 바꿔 둔다 (다음 화면부터 서버가 바로 안다)
  await supabase.auth.refreshSession();
}
