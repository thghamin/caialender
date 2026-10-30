"use client";

import { useState } from "react";
import { CalendarView, type CalendarItem } from "@/components/calendar-view";

/** 학사 캘린더. 대학원 일정은 기본으로 숨기고 체크하면 보여준다 */
export function AcademicCalendar({ items, loggedIn, manage = false }: { items: CalendarItem[]; loggedIn: boolean; manage?: boolean }) {
  const [showGrad, setShowGrad] = useState(false);
  const isGrad = (i: CalendarItem) => i.target?.includes("대학원") ?? false;
  const gradCount = items.filter(isGrad).length;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex w-fit items-center gap-2 self-end text-sm text-zinc-600">
        <input type="checkbox" checked={showGrad} onChange={(e) => setShowGrad(e.target.checked)} className="accent-brand" />
        대학원 일정도 보기 ({gradCount})
      </label>
      <CalendarView items={showGrad ? items : items.filter((i) => !isGrad(i))} loggedIn={loggedIn} manage={manage ? { calendar: "academic" } : undefined} />
    </div>
  );
}
