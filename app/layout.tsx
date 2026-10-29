import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { isMyColor, MY_COLOR_COOKIE, userColorVars } from "@/lib/my-color";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "C:AI:ender — 인공지능전공 학과 캘린더",
  description: "학과 공지방에 흩어진 일정을 AI로 정리한 공용 캘린더",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 사용자 지정 색을 <html>에 걸어서 첫 화면부터 그 색으로 그린다
  const saved = (await cookies()).get(MY_COLOR_COOKIE)?.value;
  const colorVars = isMyColor(saved) ? userColorVars(saved) : undefined;
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`} style={colorVars as React.CSSProperties}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
