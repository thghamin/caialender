"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// 앱 하단 탭은 5개 이하가 누르기 편하다(탭 하나 폭 ≈ 화면의 1/5).
// 자주 쓰는 4개 + '더보기'(공지·소통방·질문·검색·관리)

// 선 아이콘 (이모지 대신: 기기마다 모양이 달라지지 않고 앱처럼 깔끔하게)
const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  academic: (
    <>
      <path d="m2 9 10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
      <path d="M22 9v6" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  timetable: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h3M8 17h6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  notice: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h5" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  qna: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
};
function Icon({ name, className = "size-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

const MAIN = [
  { href: "/", icon: "home", label: "학과" },
  { href: "/academic", icon: "academic", label: "학사" },
  { href: "/my", icon: "star", label: "내 캘린더" },
  { href: "/timetable", icon: "timetable", label: "시간표" },
] as const;

const MORE = [
  { href: "/notices", icon: "notice", label: "공지" },
  { href: "/chat", icon: "chat", label: "소통방" },
  { href: "/qna", icon: "qna", label: "질문" },
  { href: "/search", icon: "search", label: "검색" },
] as const;

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** 휴대폰 하단 탭 메뉴 (768px 미만에서만 보인다) */
export function MobileTabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 누른 탭을 화면이 바뀌기 전에 바로 칠한다 (기다리는 느낌을 없앤다)
  const [pressed, setPressed] = useState<string | null>(null);
  const more = admin ? [...MORE, { href: "/admin", icon: "admin", label: "관리" } as const] : MORE;
  const moreActive = more.some((m) => isActive(pathname, m.href));

  // 다른 화면으로 가면 더보기 창을 닫는다
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setPressed(null);
  }
  // 더보기 안의 화면도 미리 받아 둔다 (창을 열자마자 눌러도 바로 뜨게)
  useEffect(() => {
    for (const m of MORE) router.prefetch(m.href);
    if (admin) router.prefetch("/admin");
  }, [router, admin]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 선택된 탭: 연한 테마색 둥근 바탕 + 테마색 아이콘·글자 (나머지는 회색 선 아이콘)
  const tab = (active: boolean) =>
    `flex h-full w-full flex-col items-center justify-center gap-[3px] rounded-[20px] text-[11.5px] leading-none whitespace-nowrap tracking-tight transition-colors ${
      active ? "bg-brand/10 font-bold text-brand" : "font-medium text-zinc-500 active:bg-zinc-100"
    }`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="더보기 메뉴"
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in absolute inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] rounded-3xl bg-white p-3 shadow-2xl"
          >
            <ul className="grid grid-cols-2 gap-2">
              {more.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    prefetch
                    aria-current={isActive(pathname, m.href) ? "page" : undefined}
                    className={`flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold transition-colors active:scale-[0.98] ${
                      isActive(pathname, m.href) ? "bg-brand/10 text-brand" : "bg-zinc-50 text-zinc-700 active:bg-zinc-100"
                    }`}
                  >
                    <Icon name={m.icon} className="size-7" />
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* 떠 있는 둥근 탭 바 (화면 아래·양옆에서 살짝 띄움) */}
      <nav
        aria-label="모바일 메뉴"
        className="fixed inset-x-2.5 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 rounded-[26px] border border-black/[0.06] bg-white/90 p-1.5 shadow-[0_8px_30px_-6px_rgb(0_0_0/0.18)] backdrop-blur-xl md:hidden"
      >
        <ul className="flex h-[56px] gap-1" data-tour="tabs">
          {MAIN.map((t) => {
            const active = pressed ? pressed === t.href : isActive(pathname, t.href) && !open;
            return (
              <li key={t.href} className="flex-1" data-tour={t.href === "/timetable" ? "tab-timetable" : undefined}>
                <Link href={t.href} prefetch onClick={() => t.href !== pathname && setPressed(t.href)} aria-current={active ? "page" : undefined} className={tab(active)}>
                  <Icon name={t.icon} className={`size-6 ${active ? "" : "opacity-80"}`} />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1" data-tour="tab-more">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="더보기" className={tab(open || moreActive)}>
              <Icon name={open ? "close" : "menu"} className={`size-6 ${open || moreActive ? "" : "opacity-80"}`} />
              더보기
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
