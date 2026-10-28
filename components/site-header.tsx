import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/auth/actions";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-tight">
          C<span className="text-brand">:AI:</span>ender
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-600">
          <Link href="/" className="hover:text-zinc-900">전체 캘린더</Link>
          {user && <Link href="/my" className="hover:text-zinc-900">내 캘린더</Link>}
          {user && <Link href="/notices" className="hover:text-zinc-900">공지</Link>}
          {user?.role === "admin" && (
            <Link href="/admin" className="hover:text-zinc-900 font-medium text-brand">관리자</Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-zinc-500">
                {user.name}
                {user.grade ? ` · ${user.grade}학년` : ""}
                {user.role === "admin" ? " · 기획부" : ""}
              </span>
              <form action={logout}>
                <button className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100">로그아웃</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-zinc-900">로그인</Link>
              <Link href="/signup" className="rounded-md bg-brand px-3 py-1 text-white hover:opacity-90">회원가입</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
