"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 앱 하단 탭은 5개 이하가 누르기 편하다(탭 하나 폭 ≈ 화면의 1/5).
// 자주 쓰는 4개 + '더보기'(공지·질문·검색·관리)
const MAIN = [
  { href: "/", icon: "🏫", label: "학과" },
  { href: "/academic", icon: "🎓", label: "학사" },
  { href: "/my", icon: "⭐", label: "내 캘린더" },
  { href: "/timetable", icon: "🗓️", label: "시간표" },
] as const;

const MORE = [
  { href: "/notices", icon: "📄", label: "공지" },
  { href: "/qna", icon: "💬", label: "질문" },
  { href: "/search", icon: "🔍", label: "검색" },
] as const;

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** 휴대폰 하단 탭 메뉴 (768px 미만에서만 보인다) */
export function MobileTabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const more = admin ? [...MORE, { href: "/admin", icon: "🛠️", label: "관리" } as const] : MORE;
  const moreActive = more.some((m) => isActive(pathname, m.href));

  // 다른 화면으로 가면 더보기 창을 닫는다
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tab = (active: boolean) =>
    `relative flex h-full w-full flex-col items-center justify-center gap-1 text-[13px] leading-none whitespace-nowrap tracking-tight transition-colors active:bg-zinc-100 ${
      active ? "font-bold text-brand" : "text-zinc-500"
    }`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="더보기 메뉴"
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in absolute inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] rounded-3xl bg-white p-3 shadow-2xl"
          >
            <ul className="grid grid-cols-2 gap-2">
              {more.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    prefetch
                    aria-current={isActive(pathname, m.href) ? "page" : undefined}
                    className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-base font-semibold transition-colors active:scale-[0.98] ${
                      isActive(pathname, m.href) ? "bg-brand text-white" : "bg-zinc-50 text-zinc-700 active:bg-zinc-100"
                    }`}
                  >
                    <span className="text-3xl leading-none">{m.icon}</span>
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <nav
        aria-label="모바일 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/15 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex h-[68px]" data-tour="tabs">
          {MAIN.map((t) => {
            const active = isActive(pathname, t.href) && !open;
            return (
              <li key={t.href} className="flex-1" data-tour={t.href === "/timetable" ? "tab-timetable" : undefined}>
                <Link href={t.href} prefetch aria-current={active ? "page" : undefined} className={tab(active)}>
                  {/* 선택된 탭 위쪽 막대 */}
                  {active && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-brand" />}
                  <span className={`text-[28px] leading-none ${active ? "" : "opacity-70 grayscale"}`}>{t.icon}</span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1" data-tour="tab-more">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="더보기" className={tab(open || moreActive)}>
              {(open || moreActive) && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-brand" />}
              <span className={`text-[28px] leading-none ${open || moreActive ? "" : "opacity-70 grayscale"}`}>{open ? "✕" : "☰"}</span>
              더보기
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
