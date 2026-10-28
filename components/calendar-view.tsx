"use client";

import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import koLocale from "@fullcalendar/react/locales/ko";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  kind: "event" | "deadline" | "other" | "personal";
  href?: string;
};

const COLORS: Record<CalendarItem["kind"], string> = {
  event: "#4f46e5",
  deadline: "#dc2626",
  other: "#0891b2",
  personal: "#71717a",
};

export function CalendarView({ items }: { items: CalendarItem[] }) {
  const router = useRouter();

  return (
    <div className="caialender-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, classicThemePlugin]}
        locale={koLocale}
        timeZone="Asia/Seoul"
        initialView="dayGridMonth"
        headerToolbar={{ start: "prev,next today", center: "title", end: "dayGridMonth,timeGridWeek,listMonth" }}
        height="auto"
        dayMaxEvents={3}
        events={items.map((i) => ({
          id: i.id,
          title: i.kind === "deadline" ? `⏰ ${i.title}` : i.title,
          start: i.start,
          end: endForCalendar(i),
          allDay: i.allDay,
          color: COLORS[i.kind],
          extendedProps: { href: i.href },
        }))}
        eventClick={(info) => {
          const href = info.event.extendedProps.href as string | undefined;
          if (href) {
            info.jsEvent.preventDefault();
            router.push(href);
          }
        }}
      />
    </div>
  );
}

// FullCalendar의 종일 일정 end는 '다음날 0시'(배타적)이므로 하루를 더한다
function endForCalendar(i: CalendarItem) {
  if (!i.end) return undefined;
  if (!i.allDay) return i.end;
  return new Date(new Date(i.end).getTime() + 86400_000).toISOString();
}

export function CalendarLegend({ personal = false }: { personal?: boolean }) {
  const entries: [CalendarItem["kind"], string][] = [
    ["event", "행사"],
    ["deadline", "마감"],
    ["other", "기타"],
    ...(personal ? ([["personal", "개인 일정"]] as [CalendarItem["kind"], string][]) : []),
  ];
  return (
    <div className="flex gap-3 text-xs text-zinc-500">
      {entries.map(([k, label]) => (
        <span key={k} className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full" style={{ background: COLORS[k] }} />
          {label}
        </span>
      ))}
    </div>
  );
}
