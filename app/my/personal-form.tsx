"use client";

import { startTransition, useActionState, useState } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";

// ───────── 시간 계산: 모두 KST 기준 "YYYY-MM-DDTHH:mm" 문자열로 다룬다 ─────────
type Clock = { ampm: "am" | "pm"; hour: number; minute: number }; // hour 1~12

const pad = (n: number) => String(n).padStart(2, "0");
const to24 = (c: Clock) => (c.ampm === "am" ? c.hour % 12 : (c.hour % 12) + 12);
const fromMinutes = (m: number): Clock => {
  const h24 = Math.floor(m / 60) % 24;
  return { ampm: h24 < 12 ? "am" : "pm", hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: m % 60 };
};
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
const clockLabel = (c: Clock) => `${c.ampm === "am" ? "오전" : "오후"} ${c.hour}:${pad(c.minute)}`;

const DURATIONS = [
  [30, "30분"],
  [60, "1시간"],
  [90, "1시간 30분"],
  [120, "2시간"],
  [180, "3시간"],
] as const;
const MINUTES = [0, 10, 20, 30, 40, 50];

function initialState(nowIso: string, values?: { start: string; end: string }) {
  if (values?.start && values?.end) {
    const [date, st] = values.start.split("T");
    const [eh, em] = values.end.slice(11, 16).split(":").map(Number);
    const [sh, sm] = st.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const diff = Math.round((new Date(`${values.end}:00Z`).getTime() - new Date(`${values.start}:00Z`).getTime()) / 60000);
    const preset = DURATIONS.some(([m]) => m === diff);
    return { date, start: fromMinutes(startMin), duration: preset ? diff : null, end: fromMinutes(eh * 60 + em) };
  }
  // 기본값: 지금 이후 가장 가까운 정각, 1시간
  const local = kstLocal(nowIso);
  const date = local.slice(0, 10);
  const nowMin = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const startMin = Math.min(Math.ceil((nowMin + 1) / 60) * 60, 23 * 60);
  return { date, start: fromMinutes(startMin), duration: 60 as number | null, end: fromMinutes(startMin + 60) };
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
  const [start, setStart] = useState<Clock>(init.start);
  const [duration, setDuration] = useState<number | null>(init.duration); // null = 종료 시각 직접 선택
  const [end, setEnd] = useState<Clock>(init.end);

  const today = kstLocal(nowIso).slice(0, 10);
  const startMin = to24(start) * 60 + start.minute;
  let endMin = duration ?? to24(end) * 60 + end.minute;
  if (duration !== null) endMin = startMin + duration;
  else if (endMin <= startMin) endMin += 24 * 60; // 종료가 시작보다 이르면 다음날 (예: 오후 10시 ~ 오전 2시)
  const startLocal = toLocal(date, startMin);
  const endLocal = toLocal(date, endMin);
  const nextDay = endLocal.slice(0, 10) !== date;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="제목" name="title" required maxLength={100} placeholder="예: 알바, 동아리 회의" defaultValue={values?.title} />
      <input type="hidden" name="start" value={startLocal} />
      <input type="hidden" name="end" value={endLocal} />

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">날짜</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            [0, "오늘"],
            [1, "내일"],
            [2, "모레"],
          ].map(([d, label]) => {
            const v = addDays(today, d as number);
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

      {/* 종료: 소요 시간으로 빠르게, 또는 직접 */}
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">얼마나</span>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map(([m, label]) => (
            <Chip key={m} active={duration === m} onClick={() => setDuration(m)}>
              {label}
            </Chip>
          ))}
          <Chip
            active={duration === null}
            onClick={() => {
              setEnd(fromMinutes(endMin % (24 * 60)));
              setDuration(null);
            }}
          >
            끝나는 시간 직접
          </Chip>
        </div>
      </div>
      {duration === null && <ClockPicker label="종료" value={end} onChange={setEnd} />}

      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
        🕒 <b>{formatKst(`${startLocal}:00+09:00`, false)}</b> {clockLabel(start)} ~ {nextDay && <b>다음날 </b>}
        {clockLabel(fromMinutes(endMin % (24 * 60)))}
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
      <Button disabled={pending} style={{ background: "var(--my-dark, #da2128)" }}>
        {pending ? "확인 중…" : "추가"}
      </Button>
    </form>
  );
}

/** 오전/오후 → 시(1~12) → 분(10분 단위)을 버튼으로 고른다 */
function ClockPicker({ label, value, onChange }: { label: string; value: Clock; onChange: (c: Clock) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 font-medium text-zinc-700">
        {label} <span className="font-normal text-zinc-500">{clockLabel(value)}</span>
      </legend>
      <div className="grid grid-cols-2 gap-1.5">
        {(["am", "pm"] as const).map((ap) => (
          <Chip key={ap} active={value.ampm === ap} onClick={() => onChange({ ...value, ampm: ap })} aria-label={`${label} ${ap === "am" ? "오전" : "오후"}`}>
            {ap === "am" ? "☀️ 오전" : "🌙 오후"}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
          <Chip key={h} active={value.hour === h} onClick={() => onChange({ ...value, hour: h })} aria-label={`${label} ${h}시`}>
            {h}시
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="w-6 shrink-0 text-xs text-zinc-500">분</span>
        <div className="grid flex-1 grid-cols-6 gap-1">
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

function Chip({ active, children, ...props }: { active: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      style={active ? { background: "var(--my-dark, #da2128)", borderColor: "var(--my-dark, #da2128)" } : undefined}
      className={`whitespace-nowrap rounded-lg border px-1.5 py-1.5 text-sm transition-colors ${
        active ? "font-semibold text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
