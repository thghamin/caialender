"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";
import { Chip, ClockPicker, clockLabel, fromMinutes, toMinutes, type Clock } from "@/components/time-parts";

// ───────── 시간 계산: 모두 KST 기준 "YYYY-MM-DDTHH:mm" 문자열로 다룬다 ─────────

/** 날짜 + 분(0시 기준, 24시간 넘으면 다음날) → "YYYY-MM-DDTHH:mm" */
function toLocal(date: string, minutes: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(minutes);
  return d.toISOString().slice(0, 16);
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const kstLocal = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16);

function initialState(nowIso: string, values?: { start: string; end: string; allDay: boolean }) {
  if (values?.start && values?.end) {
    const hm = (v: string) => (v.length >= 16 ? Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)) : 0);
    const date = values.start.slice(0, 10);
    const endDate = values.end.slice(0, 10);
    // 시간 지정에서 '다음날 새벽까지'는 하루짜리로 본다 (예: 오후 10시 ~ 오전 2시)
    const overnight = !values.allDay && endDate === addDays(date, 1) && hm(values.end) <= hm(values.start);
    return {
      date,
      endDate,
      allDay: values.allDay,
      multi: endDate !== date && !overnight,
      start: fromMinutes(hm(values.start)),
      end: fromMinutes(hm(values.end)),
      endTouched: true,
    };
  }
  // 기본값: 지금 이후 가장 가까운 정각부터 1시간, 하루짜리
  const local = kstLocal(nowIso);
  const nowMin = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const startMin = Math.min(Math.ceil((nowMin + 1) / 60) * 60, 23 * 60);
  const date = local.slice(0, 10);
  return { date, endDate: addDays(date, 1), allDay: false, multi: false, start: fromMinutes(startMin), end: fromMinutes(startMin + 60), endTouched: false };
}

export function PersonalEventForm({ nowIso, onSaved }: { nowIso: string; onSaved?: () => void }) {
  const [state, action, pending] = useActionState(addPersonalEvent, undefined);
  // 저장되면 창을 닫는다 (창 안에서 쓸 때)
  useEffect(() => {
    if (state?.savedAt) onSaved?.();
  }, [state?.savedAt, onSaved]);
  // 응답마다 다시 마운트해서 서버가 돌려준 입력값을 채운다
  return <InnerForm key={JSON.stringify(state ?? {})} state={state} action={action} pending={pending} nowIso={nowIso} />;
}

function InnerForm({ state, action, pending, nowIso }: {
  state: Awaited<ReturnType<typeof addPersonalEvent>>;
  action: (fd: FormData) => void;
  pending: boolean;
  nowIso: string;
}) {
  const values = state?.values;
  const init = initialState(nowIso, values);
  const form = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState(init.date);
  const [endDate, setEndDate] = useState(init.endDate);
  const [allDay, setAllDay] = useState(init.allDay);
  const [multi, setMulti] = useState(init.multi);
  const [start, setStartRaw] = useState<Clock>(init.start);
  const [end, setEndRaw] = useState<Clock>(init.end);
  // 종료를 직접 고르기 전까지는 시작 + 1시간을 따라간다
  const [endTouched, setEndTouched] = useState(init.endTouched);
  // 시작·종료 시각 고르기는 하나씩 펼친다 (처음엔 둘 다 접힘: "시작 오후 2:00 ▾")
  const [openClock, setOpenClock] = useState<"start" | "end" | null>(null);

  const setStart = (c: Clock) => {
    setStartRaw(c);
    if (!endTouched) setEndRaw(fromMinutes(toMinutes(c) + 60));
  };
  const setEnd = (c: Clock) => {
    setEndRaw(c);
    setEndTouched(true);
  };
  const pickDate = (v: string) => {
    setDate(v);
    // 기간의 마지막 날이 첫날보다 앞서지 않게
    if (endDate <= v) setEndDate(addDays(v, 1));
  };

  const today = kstLocal(nowIso).slice(0, 10);
  const startMin = toMinutes(start);
  let endMin = toMinutes(end);
  // 하루짜리에서 종료가 시작보다 이르면 다음날 (예: 오후 10시 ~ 오전 2시)
  if (!multi && endMin <= startMin) endMin += 24 * 60;
  const lastDay = multi ? endDate : date;
  const startValue = allDay ? date : toLocal(date, startMin);
  const endValue = allDay ? lastDay : toLocal(lastDay, endMin);
  const nextDay = !allDay && !multi && endValue.slice(0, 10) !== date;
  const invalid = allDay ? lastDay < date : endValue <= startValue;
  const days = Math.round((Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400_000) + 1;
  const length = endMin - startMin;

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <Field label="제목" name="title" required maxLength={100} placeholder="예: 알바, 동아리 회의, 여행" defaultValue={values?.title} />
      <input type="hidden" name="start" value={startValue} />
      <input type="hidden" name="end" value={endValue} />
      {allDay && <input type="hidden" name="all_day" value="on" />}

      {/* 하루 / 기간, 시간 지정 / 종일 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="하루 또는 기간">
          <Chip active={!multi} onClick={() => setMulti(false)}>하루</Chip>
          <Chip
            active={multi}
            onClick={() => {
              setMulti(true);
              if (endDate <= date) setEndDate(addDays(date, 1));
            }}
          >
            기간
          </Chip>
        </div>
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="시간 지정 또는 종일">
          <Chip active={!allDay} onClick={() => setAllDay(false)}>⏰ 시간</Chip>
          <Chip active={allDay} onClick={() => setAllDay(true)}>📅 종일</Chip>
        </div>
      </div>

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">{multi ? "기간" : "날짜"}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            [0, "오늘"],
            [1, "내일"],
            [2, "모레"],
          ] as const).map(([d, label]) => {
            const v = addDays(today, d);
            return (
              <Chip key={label} active={date === v} onClick={() => pickDate(v)}>
                {label}
              </Chip>
            );
          })}
          <input
            type="date"
            aria-label={multi ? "시작 날짜" : "날짜"}
            value={date}
            onChange={(e) => e.target.value && pickDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
          />
        </div>
        {multi && (
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-zinc-500">~ 마지막 날</span>
            <input
              type="date"
              aria-label="종료 날짜"
              value={endDate}
              min={date}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
            />
          </label>
        )}
      </div>

      {!allDay && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">시간</span>
          <ClockPicker
            label="시작"
            value={start}
            onChange={setStart}
            hint={multi ? "첫날 시작 시각" : undefined}
            open={openClock === "start"}
            onToggle={() => setOpenClock(openClock === "start" ? null : "start")}
          />
          <ClockPicker
            label="종료"
            value={end}
            onChange={setEnd}
            hint={multi ? "마지막 날 끝나는 시각" : !endTouched ? "시작 + 1시간 (바꾸면 직접 지정)" : undefined}
            open={openClock === "end"}
            onToggle={() => setOpenClock(openClock === "end" ? null : "end")}
          />
        </div>
      )}

      <p className={`rounded-lg px-3 py-2 text-sm ${invalid ? "bg-red-50 text-red-700" : "bg-brand-soft"}`} data-testid="personal-summary">
        🕒 <b>{formatKst(`${date}T00:00:00+09:00`, false)}</b>
        {!allDay && ` ${clockLabel(start)}`}
        {multi ? (
          <>
            {" ~ "}
            <b>{formatKst(`${lastDay}T00:00:00+09:00`, false)}</b>
            {!allDay && ` ${clockLabel(end)}`} <span className="text-zinc-500">({days}일)</span>
          </>
        ) : allDay ? (
          <span className="text-zinc-500"> 하루 종일</span>
        ) : (
          <>
            {" ~ "}
            {nextDay && <b>다음날 </b>}
            {clockLabel(end)}{" "}
            <span className="text-zinc-500">
              ({Math.floor(length / 60) ? `${Math.floor(length / 60)}시간` : ""}
              {length % 60 ? ` ${length % 60}분` : ""})
            </span>
          </>
        )}
        {invalid && " — 끝나는 때가 시작보다 빨라요"}
      </p>

      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.savedAt && <Alert kind="info">개인 일정을 추가했습니다.</Alert>}
      {state?.conflicts && values && (
        <div className="flex flex-col gap-2">
          <Alert kind="error">
            다음 일정과 시간이 겹칩니다: {state.conflicts.map((c) => `${c.title}(${formatKst(c.start_at)})`).join(", ")}
          </Alert>
          <Button
            type="button"
            className="bg-red-600"
            disabled={pending}
            onClick={() => {
              const fd = new FormData(form.current!);
              fd.set("force", "1");
              startTransition(() => action(fd));
            }}
          >
            겹쳐도 추가하기
          </Button>
        </div>
      )}
      <Button disabled={pending || invalid}>{pending ? "확인 중…" : "추가"}</Button>
    </form>
  );
}
