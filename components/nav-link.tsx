"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, strong = false, children }: { href: string; strong?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      // 메뉴 페이지는 미리 통째로 받아 두어 누르는 즉시 보인다 (staleTimes.static 동안 재사용)
      prefetch
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors lg:px-3 ${
        active ? "bg-brand text-white shadow-sm shadow-brand/25" : strong ? "font-semibold text-brand hover:bg-brand-soft" : "text-zinc-600 hover:bg-brand-soft hover:text-brand"
      }`}
    >
      {children}
    </Link>
  );
}
