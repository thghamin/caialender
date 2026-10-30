"use client";

import { startTransition, useActionState, useState } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";
import { AmPmHourPicker, Chip, clockLabel, fromMinutes, toMinutes, type Clock } from "@/components/time-parts";

// ───────── 시간 계산: 모두 KST 기준 "YYYY-MM-DDTHH:mm" 문자열로 다룬다 ─────────

const pad = (n: number) => String(n).padStart(2, "0");
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

const MINUTES = [0, 30];

function initialState(nowIso: string, values?: { start: string; end: string }) {
  if (values?.start && values?.end) {
    const hm = (v: string) => Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16));
    return { date: values.start.slice(0, 10), start: fromMinutes(hm(values.start)), end: fromMinutes(hm(values.end)), endTouched: true };
  }
  // 기본값: 지금 이후 가장 가까운 정각부터 1시간
  const local = kstLocal(nowIso);
  const nowMin = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const startMin = Math.min(Math.ceil((nowMin + 1) / 60) * 60, 23 * 60);
  return { date: local.slice(0, 10), start: fromMinutes(startMin), end: fromMinutes(startMin + 60), endTouched: false };
}

export function PersonalEventForm({ nowIso }: { nowIso: string }) {
  const [state, action, pending] = useActionState(addPersonalEvent, undefined);
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
  const [date, setDate] = useState(init.date);
  const [start, setStartRaw] = useState<Clock>(init.start);
  const [end, setEndRaw] = useState<Clock>(init.end);
  // 종료를 직접 고르기 전까지는 시작 + 1시간을 따라간다
  const [endTouched, setEndTouched] = useState(init.endTouched);

  const setStart = (c: Clock) => {
    setStartRaw(c);
    if (!endTouched) setEndRaw(fromMinutes(toMinutes(c) + 60));
  };
  const setEnd = (c: Clock) => {
    setEndRaw(c);
    setEndTouched(true);
  };

  const today = kstLocal(nowIso).slice(0, 10);
  const startMin = toMinutes(start);
  let endMin = toMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60; // 종료가 시작보다 이르면 다음날 (예: 오후 10시 ~ 오전 2시)
  const startLocal = toLocal(date, startMin);
  const endLocal = toLocal(date, endMin);
  const nextDay = endLocal.slice(0, 10) !== date;
  const length = endMin - startMin;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="제목" name="title" required maxLength={100} placeholder="예: 알바, 동아리 회의" defaultValue={values?.title} />
      <input type="hidden" name="start" value={startLocal} />
      <input type="hidden" name="end" value={endLocal} />

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">날짜</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            [0, "오늘"],
            [1, "내일"],
            [2, "모레"],
          ] as const).map(([d, label]) => {
            const v = addDays(today, d);
            return (
              <Chip key={label} active={date === v} onClick={() => setDate(v)}>
                {label}
              </Chip>
            );
          })}
          <input
            type="date"
            aria-label="날짜"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
          />
        </div>
      </div>

      <ClockPicker label="시작" value={start} onChange={setStart} />
      <ClockPicker label="종료" value={end} onChange={setEnd} hint={!endTouched ? "시작 + 1시간 (바꾸면 직접 지정)" : undefined} />

      <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
        🕒 <b>{formatKst(`${startLocal}:00+09:00`, false)}</b> {clockLabel(start)} ~ {nextDay && <b>다음날 </b>}
        {clockLabel(end)}{" "}
        <span className="text-zinc-500">
          ({Math.floor(length / 60) ? `${Math.floor(length / 60)}시간` : ""}
          {length % 60 ? ` ${length % 60}분` : ""})
        </span>
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
              const fd = new FormData();
              for (const [k, v] of Object.entries(values)) fd.set(k, v);
              fd.set("force", "1");
              startTransition(() => action(fd));
            }}
          >
            겹쳐도 추가하기
          </Button>
        </div>
      )}
      <Button disabled={pending}>{pending ? "확인 중…" : "추가"}</Button>
    </form>
  );
}

/** 오전/오후 → 시(1~12) → 분(:00 / :30)을 버튼으로 고른다 */
function ClockPicker({ label, value, onChange, hint }: { label: string; value: Clock; onChange: (c: Clock) => void; hint?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 font-medium text-zinc-700">
        {label} <span className="font-semibold text-brand">{clockLabel(value)}</span>
        {hint && <span className="ml-1 text-xs font-normal text-zinc-400">{hint}</span>}
      </legend>
      <AmPmHourPicker label={label} value={value} onChange={onChange} />
      <div className="flex items-center gap-1">
        <span className="w-6 shrink-0 text-xs text-zinc-500">분</span>
        <div className="grid flex-1 grid-cols-2 gap-1">
          {MINUTES.map((m) => (
            <Chip key={m} active={value.minute === m} onClick={() => onChange({ ...value, minute: m })} aria-label={`${label} ${pad(m)}분`}>
              :{pad(m)}
            </Chip>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
