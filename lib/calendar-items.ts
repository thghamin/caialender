import type { CalendarItem } from "@/components/calendar-view";
import type { CalendarEvent } from "@/lib/types";

export function targetLabel(e: Pick<CalendarEvent, "target_grades" | "target_note">) {
  const base = e.target_grades.length ? `${e.target_grades.join("·")}학년` : "전체";
  return e.target_note ? `${base} (${e.target_note})` : base;
}

export function toCalendarItem(e: CalendarEvent, interests?: Set<string>): CalendarItem {
  return {
    id: e.id,
    title: e.title,
    start: e.start_at,
    end: e.end_at,
    allDay: e.all_day,
    kind: e.kind,
    calendar: e.calendar,
    href: `/events/${e.id}`,
    location: e.location,
    target: targetLabel(e),
    interested: interests?.has(e.id) ?? false,
  };
}
