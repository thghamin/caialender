import { requireUser } from "@/lib/auth";
import { getInterestIds, getPersonalEvents, getPublishedEvents, pickMyEvents } from "@/lib/data/events";
import { formatKst, requestNow } from "@/lib/datetime";
import { CalendarLegend, CalendarView } from "@/components/calendar-view";
import { UpcomingList } from "@/components/upcoming-list";
import { BriefingCard } from "@/components/briefing-card";
import { Card } from "@/components/ui";
import { PersonalEventForm } from "./personal-form";
import { DeletePersonalButton } from "./delete-personal";

export default async function MyPage() {
  const user = await requireUser();
  const [events, interests, personal] = await Promise.all([
    getPublishedEvents(),
    getInterestIds(user.id),
    getPersonalEvents(user.id),
  ]);
  const mine = pickMyEvents(events, user, interests);
  const upcomingPersonal = personal.filter((p) => new Date(p.end_at).getTime() >= requestNow());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">내 캘린더</h1>
            <p className="text-sm text-zinc-500">
              {user.grade ? `${user.grade}학년 대상` : "학년 미설정"} · 전체 대상 · 관심 일정 {interests.size}개 · 개인 일정
            </p>
          </div>
          <CalendarLegend personal />
        </div>
        <Card className="p-3">
          <CalendarView
            items={[
              ...mine.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start_at,
                end: e.end_at,
                allDay: e.all_day,
                kind: e.kind,
                href: `/events/${e.id}`,
              })),
              ...personal.map((p) => ({
                id: p.id,
                title: p.title,
                start: p.start_at,
                end: p.end_at,
                allDay: false,
                kind: "personal" as const,
              })),
            ]}
          />
        </Card>
      </section>
      <aside className="flex flex-col gap-4">
        <BriefingCard scope="me" />
        <UpcomingList events={mine} title="나의 다가오는 일정" />
        <Card>
          <h2 className="font-semibold mb-3">개인 일정 추가</h2>
          <PersonalEventForm />
          {upcomingPersonal.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3">
              {upcomingPersonal.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="text-zinc-500">{formatKst(p.start_at)}</span> {p.title}
                  </span>
                  <DeletePersonalButton id={p.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
