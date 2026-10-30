import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseEnv } from "./env";

// 로그인 없이 열 수 있는 경로. /api/jobs는 예약 작업이 CRON_SECRET으로 호출한다.
// manifest·서비스 워커·아이콘은 앱 설치와 알림에 필요하다
const PUBLIC_PATHS = ["/login", "/signup", "/auth/", "/api/jobs/", "/manifest.webmanifest", "/sw.js", "/icons/"];

const isPublic = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));

/**
 * 만료된 access token을 갱신하고 쿠키를 응답에 반영한다.
 * 로그인하지 않은 사용자는 로그인 화면으로 보낸다. 승인 여부는 각 페이지·액션에서 서버가 다시 확인한다(requireUser).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims()는 만료된 토큰을 갱신하고, 비대칭 서명(ES256) JWT를 공개키로 로컬 검증한다.
  // getUser()와 달리 요청마다 Auth 서버를 왕복하지 않아 빠르다.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims.sub ? data.claims : null;

  const { pathname, search } = request.nextUrl;
  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}
