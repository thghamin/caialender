import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/** 요청한 사용자의 권한(RLS)으로 동작하는 서버용 클라이언트 */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없음. 세션 갱신은 proxy.ts가 담당.
        }
      },
    },
  });
}

/** RLS를 우회하는 관리용 클라이언트. 서버에서 권한 확인 후에만 사용할 것 */
export function createServiceClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  return createPlainClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
