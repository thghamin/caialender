"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, strong = false, children }: { href: string; strong?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-brand text-white shadow-sm shadow-red-200" : strong ? "font-semibold text-brand hover:bg-brand-soft" : "text-zinc-600 hover:bg-brand-soft hover:text-brand"
      }`}
    >
      {children}
    </Link>
  );
}
