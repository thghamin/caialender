"use client";

import { useState } from "react";
import { Chip, ClockPicker, clockLabel, fromMinutes, toMinutes, type Clock } from "@/components/time-parts";
import { formatKst } from "@/lib/datetime";

const pad = (n: number) => String(n).padStart(2, "0");
const minutesOf = (v: string) => (v.length >= 16 ? Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)) : null);
const local = (date: string, c: Clock) => `${date}T${pad(Math.floor(toMinutes(c) / 60))}:${pad(toMinutes(c) % 60)}`;

/**
 * 관리자 일정의 날짜·시각: '시간 지정 / 종일'을 고르고, 날짜는 달력 칸, 시각은 오전/오후·시·분 버튼으로.
 * 종료는 선택(없음 / 있음). 서버에는 예전과 같은 start·end("YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:mm")와 all_day를 보낸다.
 */
export function EventTimeFields({ initial, initialAllDay }: { initial: { start: string; end: string }; initialAllDay: boolean }) {
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startDate, setStartDate] = useState(initial.start.slice(0, 10));
  const [startTime, setStartTime] = useState<Clock>(fromMinutes(minutesOf(initial.start) ?? 10 * 60));
  const [hasEnd, setHasEnd] = useState(!!initial.end);
  const [endDate, setEndDate] = useState((initial.end || initial.start).slice(0, 10));
  const [endTime, setEndTime] = useState<Clock>(fromMinutes(minutesOf(initial.end) ?? (minutesOf(initial.start) ?? 10 * 60) + 60));
  const [openClock, setOpenClock] = useState<"start" | "end" | null>(null);

  const start = allDay ? startDate : local(startDate, startTime);
  const end = !hasEnd ? "" : allDay ? endDate : local(endDate, endTime);
  const backwards = hasEnd && end < start;

  // 종료를 시작 + N분으로 바로 맞추기 (날짜가 넘어가면 다음날)
  const endAfter = (mins: number) => {
    const total = toMinutes(startTime) + mins;
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.floor(total / 1440));
    setHasEnd(true);
    setEndDate(d.toISOString().slice(0, 10));
    setEndTime(fromMinutes(total));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 text-sm">
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />
      {allDay && <input type="hidden" name="all_day" value="on" />}

      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-zinc-700">일시</span>
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="시간 지정 방식">
          <Chip active={!allDay} onClick={() => setAllDay(false)}>⏰ 시간 지정</Chip>
          <Chip active={allDay} onClick={() => setAllDay(true)}>📅 종일</Chip>
        </div>
      </div>

      {/* 시작 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-zinc-500">시작</span>
        <input
          type="date"
          aria-label="시작 날짜"
          value={startDate}
          required
          onChange={(e) => {
            if (!e.target.value) return;
            // 종료 날짜가 시작보다 앞이 되지 않게 같이 옮긴다
            if (endDate < e.target.value) setEndDate(e.target.value);
            setStartDate(e.target.value);
          }}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[16px] md:text-sm"
        />
        {!allDay && (
          <ClockPicker label="시작" value={startTime} onChange={setStartTime} open={openClock === "start"} onToggle={() => setOpenClock(openClock === "start" ? null : "start")} />
        )}
      </div>

      {/* 종료 (선택) */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-3">
        <span className="text-xs font-semibold text-zinc-500">종료 (선택)</span>
        <div className={`grid gap-1 ${allDay ? "grid-cols-2" : "grid-cols-4"}`} role="group" aria-label="종료">
          <Chip active={!hasEnd} onClick={() => setHasEnd(false)}>없음</Chip>
          {allDay ? (
            <Chip active={hasEnd} onClick={() => setHasEnd(true)}>여러 날</Chip>
          ) : (
            <>
              <Chip active={false} onClick={() => endAfter(60)}>+1시간</Chip>
              <Chip active={false} onClick={() => endAfter(120)}>+2시간</Chip>
              <Chip active={hasEnd} onClick={() => setHasEnd(true)}>직접</Chip>
            </>
          )}
        </div>
        {hasEnd && (
          <>
            <input
              type="date"
              aria-label="종료 날짜"
              value={endDate}
              min={startDate}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[16px] md:text-sm"
            />
            {!allDay && (
              <ClockPicker label="종료" value={endTime} onChange={setEndTime} open={openClock === "end"} onToggle={() => setOpenClock(openClock === "end" ? null : "end")} />
            )}
          </>
        )}
      </div>

      {/* 요약 */}
      <p className={`rounded-lg px-3 py-2 ${backwards ? "bg-red-50 text-red-700" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`} data-testid="event-time-summary">
        🗓️ <b>{formatKst(`${startDate}T00:00:00+09:00`, false)}</b>
        {!allDay && ` ${clockLabel(startTime)}`}
        {hasEnd && (
          <>
            {" ~ "}
            {endDate !== startDate && <b>{formatKst(`${endDate}T00:00:00+09:00`, false)} </b>}
            {!allDay && clockLabel(endTime)}
          </>
        )}
        {allDay && !hasEnd && " (종일)"}
        {backwards && " — 종료가 시작보다 빨라요"}
      </p>
    </div>
  );
}
