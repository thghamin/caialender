import Link from "next/link";
import { getCurrentUserId, getTourDone, requireUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { getInterestIds, getPublishedEvents } from "@/lib/data/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toCalendarItem } from "@/lib/calendar-items";
import { CalendarLegend, CalendarView } from "@/components/calendar-view";
import { UpcomingList } from "@/components/upcoming-list";
import { BriefingCard } from "@/components/briefing-card";
import { PageHero } from "@/components/page-hero";
import { Alert, Card } from "@/components/ui";
import { OnboardingTour } from "@/components/onboarding-tour";
import { Suspense } from "react";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <Alert kind="error">Supabase가 설정되지 않았습니다. .env.local을 확인하세요.</Alert>;
  }
  const userId = await getCurrentUserId();
  // 프로필(승인 확인)·일정·관심 일정을 병렬로 조회. 승인 전이면 requireUser가 안내 화면으로 보낸다
  const [user, events, interests, tourDone] = await Promise.all([
    requireUser(),
    getPublishedEvents("dept"),
    userId ? getInterestIds(userId) : new Set<string>(),
    getTourDone(),
  ]);
  const admin = isAdminRole(user.role);

  return (
    // 학과 캘린더는 초록 테마 + 배경 K:AI 무늬 (학사 캘린더는 KNU 빨강 유지)
    <div className="theme-dept dept-backdrop flex flex-col gap-6">
      <PageHero
        tone="dept"
        badge="K:AI · 경북대학교 인공지능전공"
        title="학과 캘린더"
        subtitle="학생회가 공지방에 올린 공지를 AI가 정리하고, 기획부가 검수해 게시한 우리 과 일정이에요."
      >
        <Link href="/academic" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50">
          학사 캘린더 보기
        </Link>
        <Link href="/my" className="rounded-full px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-white/50 hover:bg-white/10">
          내 캘린더 →
        </Link>
        {admin && (
          <Link href="/admin/events/new?cal=dept" className="rounded-full bg-zinc-900/80 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-900">
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
            <CalendarLegend keys={["dept-event", "dept-deadline", "dept-other"]} />
          </div>
          <Card className="p-3" data-tour="calendar">
            <CalendarView items={events.map((e) => toCalendarItem(e, interests))} loggedIn manage={admin ? { calendar: "dept" } : undefined} />
          </Card>
        </section>
        <aside className="flex min-w-0 flex-col gap-4">
          <div data-tour="briefing">
            <BriefingCard scope="all" />
          </div>
          <UpcomingList events={events} title="다가오는 학과 일정" />
        </aside>
      </div>
      {/* 처음 들어온 학생에게 화면 소개 (?tour=1 이면 다시 보기) */}
      <Suspense>
        <OnboardingTour accountDone={tourDone} />
      </Suspense>
    </div>
  );
}
