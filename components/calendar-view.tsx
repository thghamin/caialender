"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import koLocale from "@fullcalendar/react/locales/ko";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { toggleInterest } from "@/app/my/actions";
import { formatKst } from "@/lib/datetime";
import { CALENDAR_LABEL, KIND_LABEL, type CalendarKind, type EventKind } from "@/lib/types";

export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  kind: EventKind | "personal";
  calendar?: CalendarKind;
  href?: string;
  location?: string | null;
  target?: string;
  /** 내 캘린더에 직접 추가한 일정인지 */
  interested?: boolean;
};

type ColorKey = "dept-event" | "dept-deadline" | "dept-other" | "academic" | "academic-holiday" | "personal";

// 학과 일정은 초록(전자공학부), 학사일정은 회색·금색(KNU), 개인 일정은 사용자 지정 색(--brand)
const COLORS: Record<ColorKey, string> = {
  "dept-event": "#16a34a",
  "dept-deadline": "#9f1239",
  "dept-other": "#0d9488",
  academic: "#52525b",
  "academic-holiday": "#c48a3c",
  personal: "var(--brand)",
};

const LEGEND_LABEL: Record<ColorKey, string> = {
  "dept-event": "학과 행사",
  "dept-deadline": "마감",
  "dept-other": "학과 기타",
  academic: "학사일정",
  "academic-holiday": "공휴일·연휴",
  personal: "개인 일정",
};

function colorKey(i: Pick<CalendarItem, "kind" | "calendar">): ColorKey {
  if (i.kind === "personal") return "personal";
  if (i.kind === "deadline") return "dept-deadline";
  if (i.calendar === "academic") return i.kind === "other" ? "academic-holiday" : "academic";
  return i.kind === "other" ? "dept-other" : "dept-event";
}

export function CalendarView({ items, loggedIn = false }: { items: CalendarItem[]; loggedIn?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

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
          title: `${i.kind === "deadline" ? "⏰ " : ""}${i.interested ? "★ " : ""}${i.title}`,
          start: i.start,
          end: endForCalendar(i),
          allDay: i.allDay,
          color: COLORS[colorKey(i)],
        }))}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          setSelectedId(info.event.id);
        }}
      />
      {selected && <EventPopup key={selected.id} item={selected} loggedIn={loggedIn} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function EventPopup({ item, loggedIn, onClose }: { item: CalendarItem; loggedIn: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [interested, setInterested] = useState(!!item.interested);
  const color = COLORS[colorKey(item)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const when = item.end
    ? `${formatKst(item.start, !item.allDay)} ~ ${formatKst(item.end, !item.allDay)}`
    : formatKst(item.start, !item.allDay);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="h-2" style={{ background: color }} />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: color }}>
              {item.kind === "personal" ? "개인 일정" : CALENDAR_LABEL[item.calendar ?? "dept"]}
            </span>
            {item.kind !== "personal" && <span className="text-zinc-500">{KIND_LABEL[item.kind]}</span>}
            <button onClick={onClose} className="ml-auto text-lg leading-none text-zinc-400 hover:text-zinc-700" aria-label="닫기">
              ×
            </button>
          </div>
          <h3 className="text-lg font-bold leading-snug">{item.title}</h3>
          <dl className="grid grid-cols-[52px_1fr] gap-y-1 text-sm">
            <dt className="text-zinc-500">일시</dt>
            <dd>{when}</dd>
            {item.location && (
              <>
                <dt className="text-zinc-500">장소</dt>
                <dd>{item.location}</dd>
              </>
            )}
            {item.target && (
              <>
                <dt className="text-zinc-500">대상</dt>
                <dd>{item.target}</dd>
              </>
            )}
          </dl>
          {item.kind !== "personal" && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {loggedIn ? (
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await toggleInterest(item.id, !interested);
                      setInterested(!interested);
                    })
                  }
                  // 페이지 색(--accent)을 따른다: 학과 초록, 학사 빨강, 내 캘린더 사용자 지정
                  style={interested ? undefined : { background: "var(--accent)" }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    interested ? "border border-zinc-300 bg-white hover:bg-zinc-100" : "text-white shadow-sm hover:brightness-95"
                  }`}
                >
                  {pending ? "처리 중…" : interested ? "★ 내 캘린더에서 빼기" : "☆ 내 캘린더에 추가"}
                </button>
              ) : (
                <Link href={`/login?next=/events/${item.id}`} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                  로그인하고 내 캘린더에 추가
                </Link>
              )}
              {item.href && (
                <Link href={item.href} className="rounded-full px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
                  자세히 보기 →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// FullCalendar의 종일 일정 end는 '다음날 0시'(배타적)이므로 하루를 더한다
function endForCalendar(i: CalendarItem) {
  if (!i.end) return undefined;
  if (!i.allDay) return i.end;
  return new Date(new Date(i.end).getTime() + 86400_000).toISOString();
}

export function CalendarLegend({ keys }: { keys: ColorKey[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full" style={{ background: COLORS[k] }} />
          {LEGEND_LABEL[k]}
        </span>
      ))}
    </div>
  );
}
