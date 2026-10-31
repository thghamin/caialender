import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { isMyColor, MY_COLOR_COOKIE, userColorVars } from "@/lib/my-color";
import { PC_VIEWPORT_WIDTH, VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { InAppGuard } from "@/components/in-app-guard";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "C:AI:ender — 인공지능전공 학과 캘린더",
  description: "학과 공지방에 흩어진 일정을 AI로 정리한 공용 캘린더",
  // 아이폰 홈 화면에 추가했을 때 앱처럼 열리게 (아이폰은 이렇게 설치해야 알림을 받을 수 있다)
  appleWebApp: { capable: true, title: "C:AI:ender", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

/** 휴대폰에서 'PC 버전'을 고르면 화면 폭을 1280으로 잡아 PC 배치로 보여준다. 기본은 기기 폭(모바일 배치) */
export async function generateViewport(): Promise<Viewport> {
  const pc = (await cookies()).get(VIEW_MODE_COOKIE)?.value === "pc";
  return pc ? { width: PC_VIEWPORT_WIDTH } : { width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 사용자 지정 색을 <html>에 걸어서 첫 화면부터 그 색으로 그린다
  const cookieStore = await cookies();
  const saved = cookieStore.get(MY_COLOR_COOKIE)?.value;
  const viewMode = cookieStore.get(VIEW_MODE_COOKIE)?.value === "pc" ? "pc" : "mobile";
  const colorVars = isMyColor(saved) ? userColorVars(saved) : undefined;
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`} style={colorVars as React.CSSProperties}>
      <head>
        {/* Pretendard는 PC 화면에서만 받는다(media). 휴대폰은 기기 기본 글꼴이라 내려받지 않는다 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          media="(min-width: 768px)"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {/* 카카오톡 등 앱 안의 브라우저면 Safari/크롬으로 열도록 (로그인 화면 포함 모든 화면) */}
        <InAppGuard />
        <SiteHeader />
        {/* 휴대폰에서는 하단 탭 메뉴에 가리지 않도록 아래 여백 */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 pt-4 pb-28 sm:px-4 md:py-6">{children}</main>
        <footer className="flex flex-col items-center gap-2 px-4 pb-28 pt-2 md:pb-6">
          <ViewModeToggle mode={viewMode} />
          <Link href="/?tour=1" className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline">
            사용법 다시 보기
          </Link>
          {/* 정식 출시 전 안내 (휴대폰·PC 모두 맨 아래) */}
          <p className="max-w-md text-center text-[11.5px] leading-relaxed text-zinc-400" data-testid="beta-note">
            <span className="mr-1 rounded-full bg-zinc-200/70 px-1.5 py-px text-[10.5px] font-bold text-zinc-500">BETA</span>
            C:AI:ender는 아직 정식 출시 전 서비스예요. 사용하면서 받는 피드백을 바탕으로 계속 보완하고 있어요.{" "}
            <Link href="/qna" className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
              의견 남기기
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
