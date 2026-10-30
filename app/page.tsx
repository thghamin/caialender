import Link from "next/link";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { getInterestIds, getPublishedEvents } from "@/lib/data/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toCalendarItem } from "@/lib/calendar-items";
import { CalendarLegend, CalendarView } from "@/components/calendar-view";
import { UpcomingList } from "@/components/upcoming-list";
import { BriefingCard } from "@/components/briefing-card";
import { PageHero } from "@/components/page-hero";
import { Alert, Card } from "@/components/ui";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <Alert kind="error">Supabase가 설정되지 않았습니다. .env.local을 확인하세요.</Alert>;
  }
  const userId = await getCurrentUserId();
  // 프로필(승인 확인)·일정·관심 일정을 병렬로 조회. 승인 전이면 requireUser가 안내 화면으로 보낸다
  const [, events, interests] = await Promise.all([
    requireUser(),
    getPublishedEvents("dept"),
    userId ? getInterestIds(userId) : new Set<string>(),
  ]);

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
      </PageHero>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">일정을 누르면 내 캘린더에 바로 추가할 수 있어요.</p>
            <CalendarLegend keys={["dept-event", "dept-deadline", "dept-other"]} />
          </div>
          <Card className="p-3">
            <CalendarView items={events.map((e) => toCalendarItem(e, interests))} loggedIn />
          </Card>
        </section>
        <aside className="flex flex-col gap-4">
          <BriefingCard scope="all" />
          <UpcomingList events={events} title="다가오는 학과 일정" />
        </aside>
      </div>
    </div>
  );
}
