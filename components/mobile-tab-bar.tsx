"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "🏫", label: "학과" },
  { href: "/academic", icon: "🎓", label: "학사" },
  { href: "/my", icon: "⭐", label: "내 캘린더" },
  { href: "/timetable", icon: "🗓️", label: "시간표" },
  { href: "/notices", icon: "📄", label: "공지" },
  { href: "/qna", icon: "💬", label: "질문" },
] as const;

/** 휴대폰 하단 탭 메뉴 (768px 미만에서만 보인다) */
export function MobileTabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const tabs = admin ? [...TABS, { href: "/admin", icon: "🛠️", label: "관리" } as const] : TABS;
  return (
    <nav
      aria-label="모바일 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/15 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[13px] leading-none whitespace-nowrap tracking-tight ${
                  active ? "font-bold text-brand" : "text-zinc-500"
                }`}
              >
                {/* 선택된 탭 위쪽 막대 */}
                {active && <span className="absolute inset-x-2 top-0 h-[3px] rounded-b-full bg-brand" />}
                <span className={`text-[26px] leading-none ${active ? "" : "opacity-70 grayscale"}`}>{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
