import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPublishedEvents } from "@/lib/data/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CalendarLegend, CalendarView } from "@/components/calendar-view";
import { UpcomingList } from "@/components/upcoming-list";
import { BriefingCard } from "@/components/briefing-card";
import { Alert, Card } from "@/components/ui";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <Alert kind="error">Supabase가 설정되지 않았습니다. .env.local을 확인하세요.</Alert>;
  }
  const [user, events] = await Promise.all([getCurrentUser(), getPublishedEvents()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">전체 캘린더</h1>
            <p className="text-sm text-zinc-500">학생회 기획부가 검수한 인공지능전공의 모든 일정</p>
          </div>
          <CalendarLegend />
        </div>
        <Card className="p-3">
          <CalendarView
            items={events.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start_at,
              end: e.end_at,
              allDay: e.all_day,
              kind: e.kind,
              href: `/events/${e.id}`,
            }))}
          />
        </Card>
      </section>
      <aside className="flex flex-col gap-4">
        <BriefingCard scope="all" />
        {!user && (
          <Card>
            <p className="text-sm text-zinc-600">
              로그인하면 내 학년에 맞는 일정과 관심 일정을 <b>내 캘린더</b>에 모아볼 수 있어요.
            </p>
            <Link href="/signup" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
              회원가입 →
            </Link>
          </Card>
        )}
        <UpcomingList events={events} title="다가오는 일정" />
      </aside>
    </div>
  );
}
