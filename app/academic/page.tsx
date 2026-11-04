import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { getInterestIds, getPublishedEvents } from "@/lib/data/events";
import { toCalendarItem } from "@/lib/calendar-items";
import { KNU_SCHEDULE_URL } from "@/lib/academic/knu-schedule";
import { CalendarLegend } from "@/components/calendar-view";
import { UpcomingList } from "@/components/upcoming-list";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { AcademicCalendar } from "./academic-calendar";

export const metadata: Metadata = { title: "학사 캘린더 — C:AI:ender" };

export default async function AcademicPage() {
  const userId = await getCurrentUserId();
  // 프로필(승인 확인)·일정·관심 일정을 병렬로 조회. 승인 전이면 requireUser가 안내 화면으로 보낸다
  const [user, events, interests] = await Promise.all([
    requireUser(),
    getPublishedEvents("academic"),
    userId ? getInterestIds(userId) : new Set<string>(),
  ]);
  const undergrad = events.filter((e) => e.target_note !== "대학원");
  const admin = isAdminRole(user.role);

  return (
    // 학사 캘린더는 KNU 빨강 고정
    <div className="theme-academic flex flex-col gap-6">
      <PageHero
        tone="knu"
        badge="경북대학교 공식 학사일정"
        title="학사 캘린더"
        subtitle={
          <>
            개강, 수강신청, 시험, 휴학·복학 접수, 공휴일까지 학교 학사일정을 모았어요. 필요한 일정은 눌러서 내 캘린더에 넣으세요.{" "}
            <a href={KNU_SCHEDULE_URL(2026)} target="_blank" rel="noreferrer" className="font-semibold text-red-600 underline underline-offset-2 hover:text-red-700">
              출처: 경북대학교 홈페이지
            </a>
          </>
        }
      >
        {/* 학과 캘린더와 같은 배치: 다른 캘린더로 가는 버튼 (학사는 빨강) */}
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-red-500 to-red-600 px-4 py-2 text-[13.5px] font-bold text-white shadow-md shadow-red-600/25 hover:brightness-105">
          학과 캘린더 보기 <span aria-hidden>→</span>
        </Link>
        <Link href="/my" className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-[13.5px] font-bold text-red-600 ring-1 ring-red-300 hover:bg-white">
          내 캘린더 <span aria-hidden>→</span>
        </Link>
        {admin && (
          <Link href="/admin/events/new?cal=academic" className="rounded-full bg-zinc-900 px-4 py-2 text-[13.5px] font-bold text-white hover:bg-zinc-800">
            + 일정 추가
          </Link>
        )}
      </PageHero>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">
              {admin ? "일정을 누르면 수정 · 빈 날짜를 누르면 추가" : "일정을 누르면 내 캘린더에 추가할 수 있어요."}
            </p>
            <CalendarLegend keys={["academic", "dept-deadline", "academic-holiday"]} />
          </div>
          <Card className="p-2! sm:p-3!">
            <AcademicCalendar items={events.map((e) => toCalendarItem(e, interests))} loggedIn manage={admin} />
          </Card>
        </section>
        <aside className="flex min-w-0 flex-col gap-4">
          <UpcomingList events={undergrad} title="다가오는 학사일정" />
        </aside>
      </div>
    </div>
  );
}
