import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isMyColor, MY_COLOR_COOKIE } from "@/lib/my-color";
import { MyColorPicker } from "./color-picker";
import { getCurrentUserId, requireUser } from "@/lib/auth";
import { getInterestIds, getPersonalEvents, getPublishedEvents, pickMyEvents } from "@/lib/data/events";
import { formatKst, requestNow } from "@/lib/datetime";
import { CalendarLegend, CalendarView } from "@/components/calendar-view";
import { toCalendarItem } from "@/lib/calendar-items";
import { PageHero } from "@/components/page-hero";
import { UpcomingList } from "@/components/upcoming-list";
import { BriefingCard } from "@/components/briefing-card";
import { Card } from "@/components/ui";
import { PersonalEventForm } from "./personal-form";
import { DeletePersonalButton } from "./delete-personal";

export default async function MyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  // 프로필(승인 확인)·일정·관심 일정·개인 일정을 병렬로 조회
  const [user, events, interests, personal, cookieStore] = await Promise.all([
    requireUser(),
    getPublishedEvents(),
    getInterestIds(userId),
    getPersonalEvents(userId),
    cookies(),
  ]);
  const saved = cookieStore.get(MY_COLOR_COOKIE)?.value;
  const color = isMyColor(saved) ? saved : "red";
  const mine = pickMyEvents(events, user, interests);
  const upcomingPersonal = personal.filter((p) => new Date(p.end_at).getTime() >= requestNow());

  const academicCount = mine.filter((e) => e.calendar === "academic").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        tone="custom"
        badge={user.grade ? `${user.grade}학년 ${user.name}` : user.name}
        title="내 캘린더"
        subtitle={`내 학년·전체 대상 학과 일정 + 직접 담은 일정 ${interests.size}개(학사일정 ${academicCount}개) + 개인 일정 ${personal.length}개`}
      >
        <MyColorPicker initial={color} />
      </PageHero>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">학사·학과 캘린더에서 일정을 눌러 ☆를 누르면 여기에 담겨요.</p>
          <CalendarLegend keys={["dept-event", "dept-deadline", "academic", "academic-holiday", "personal"]} />
        </div>
        <Card className="p-3">
          <CalendarView
            loggedIn
            items={[
              ...mine.map((e) => toCalendarItem(e, interests)),
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
          <PersonalEventForm nowIso={new Date(requestNow()).toISOString()} />
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
    </div>
  );
}
