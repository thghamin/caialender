import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { isAdminRole, ROLE_LABEL } from "@/lib/types";
import { Hobanu } from "./hobanu";
import { NavLink } from "./nav-link";
import { MobileTabBar } from "./mobile-tab-bar";
import { InstallPrompt } from "./install-prompt";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const admin = isAdminRole(user?.role);
  // 승인 전 회원에게는 메뉴를 보여주지 않는다
  const approved = user?.approval_status === "approved";

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-brand/15 bg-white/90 backdrop-blur">
      <div className="h-1 bg-gradient-to-r from-brand via-brand-dark to-knu-gold" />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 md:h-16 flex items-center gap-3 md:gap-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <Hobanu className="size-9 drop-shadow-sm" title="" />
          <span>
            C<span className="text-brand">:AI:</span>ender
          </span>
        </Link>
        {/* PC 메뉴. 휴대폰은 화면 아래 탭 메뉴(MobileTabBar) */}
        <nav className="hidden gap-1 text-sm md:flex" data-tour="nav">
          {approved && <NavLink href="/">학과 캘린더</NavLink>}
          {approved && <NavLink href="/academic">학사 캘린더</NavLink>}
          {approved && <NavLink href="/my">내 캘린더</NavLink>}
          {approved && <NavLink href="/timetable">내 시간표</NavLink>}
          {approved && <NavLink href="/notices">공지</NavLink>}
          {approved && <NavLink href="/chat">소통방</NavLink>}
          {approved && <NavLink href="/qna">질문</NavLink>}
          {admin && <NavLink href="/admin" strong>관리자</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm md:gap-3">
          {user ? (
            <>
              {approved && (
                <Link href="/search" aria-label="검색" title="검색" className="grid size-9 place-items-center rounded-full text-lg hover:bg-brand-soft">
                  🔍
                </Link>
              )}
              <span className="text-zinc-500">
                <span className="hidden sm:inline">
                  {user.name}
                  {user.grade ? ` · ${user.grade}학년` : ""}
                </span>
                {user.role !== "student" && (
                  <span className="ml-1.5 whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                    {/* 휴대폰은 짧게 */}
                    <span className="sm:hidden">{user.role === "super_admin" ? "총관리" : "관리자"}</span>
                    <span className="hidden sm:inline">{ROLE_LABEL[user.role]}</span>
                  </span>
                )}
              </span>
              <form action={logout}>
                <button className="whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100">로그아웃</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand">로그인</Link>
              <Link href="/signup" className="rounded-full bg-brand px-4 py-1.5 font-medium text-white shadow-sm shadow-brand/25 hover:bg-brand-dark">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
    {/* header의 backdrop-blur 안에 두면 fixed가 화면 기준이 아니게 되므로 밖에 둔다 */}
    {approved && <MobileTabBar admin={admin} />}
    {/* 로그인(승인)한 휴대폰 사용자에게 앱 설치 권유 */}
    {approved && <InstallPrompt />}
    </>
  );
}
