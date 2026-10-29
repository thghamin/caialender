"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";

// ───────── 시간 계산: 모두 KST 기준 "YYYY-MM-DDTHH:mm" 문자열로 다룬다 ─────────
type Clock = { ampm: "am" | "pm"; hour: number; minute: number }; // hour 1~12

const pad = (n: number) => String(n).padStart(2, "0");
const to24 = (c: Clock) => (c.ampm === "am" ? c.hour % 12 : (c.hour % 12) + 12);
const toMinutes = (c: Clock) => to24(c) * 60 + c.minute;
const fromMinutes = (m: number): Clock => {
  const mm = ((m % 1440) + 1440) % 1440;
  const h24 = Math.floor(mm / 60);
  return { ampm: h24 < 12 ? "am" : "pm", hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: mm % 60 };
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

const MINUTES = [0, 10, 20, 30, 40, 50];

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

/** 오전/오후 → 시(1~12) → 분(10분 단위, '직접'을 누르면 시계로 1분 단위)을 버튼으로 고른다 */
function ClockPicker({ label, value, onChange, hint }: { label: string; value: Clock; onChange: (c: Clock) => void; hint?: string }) {
  const [dial, setDial] = useState(false);
  const custom = !MINUTES.includes(value.minute);
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 font-medium text-zinc-700">
        {label} <span className="font-semibold text-brand">{clockLabel(value)}</span>
        {hint && <span className="ml-1 text-xs font-normal text-zinc-400">{hint}</span>}
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
        <div className="grid flex-1 grid-cols-4 gap-1">
          {MINUTES.map((m) => (
            <Chip
              key={m}
              active={value.minute === m}
              onClick={() => {
                onChange({ ...value, minute: m });
                setDial(false);
              }}
              aria-label={`${label} ${pad(m)}분`}
            >
              :{pad(m)}
            </Chip>
          ))}
          <Chip
            active={custom || dial}
            onClick={() => setDial(!dial)}
            aria-label={`${label} 분 직접`}
            aria-expanded={dial}
            className="col-span-2"
          >
            {custom ? `🕒 :${pad(value.minute)}` : "🕒 직접 (1분 단위)"}
          </Chip>
        </div>
      </div>
      {dial && <MinuteDial label={label} minute={value.minute} onChange={(m) => onChange({ ...value, minute: m })} onDone={() => setDial(false)} />}
    </fieldset>
  );
}

/** 시계 모양 분 선택: 바늘을 끌거나 원을 눌러서 고르고, ±1분 버튼으로 미세 조정 */
function MinuteDial({ label, minute, onChange, onDone }: { label: string; minute: number; onChange: (m: number) => void; onDone: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const R = 80;
  const C = 100;

  const pick = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 200 - C;
    const y = ((clientY - box.top) / box.height) * 200 - C;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI; // 12시 방향 0도, 시계 방향
    onChange((Math.round(((deg + 360) % 360) / 6) + 60) % 60);
  };
  const angle = (minute / 60) * 2 * Math.PI;
  const hx = C + Math.sin(angle) * (R - 14);
  const hy = C - Math.cos(angle) * (R - 14);

  return (
    <div className="mt-1 flex flex-col items-center gap-2 rounded-xl border border-brand/20 bg-white p-3 shadow-sm">
      <p className="text-xs text-zinc-500">바늘을 돌리거나 원을 눌러 분을 고르세요</p>
      <svg
        ref={svg}
        viewBox="0 0 200 200"
        className="size-52 touch-none select-none"
        role="slider"
        aria-label={`${label} 분`}
        aria-valuemin={0}
        aria-valuemax={59}
        aria-valuenow={minute}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((minute + 1) % 60);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((minute + 59) % 60);
        }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging.current && pick(e.clientX, e.clientY)}
        onPointerUp={() => (dragging.current = false)}
      >
        <circle cx={C} cy={C} r={R + 12} fill="var(--brand-soft)" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          const long = i % 5 === 0;
          const r1 = R + 6;
          const r2 = long ? R - 2 : R + 2;
          return (
            <line
              key={i}
              x1={C + Math.sin(a) * r1}
              y1={C - Math.cos(a) * r1}
              x2={C + Math.sin(a) * r2}
              y2={C - Math.cos(a) * r2}
              stroke={long ? "#52525b" : "#a1a1aa"}
              strokeWidth={long ? 2 : 1}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI;
          return (
            <text key={i} x={C + Math.sin(a) * (R - 16)} y={C - Math.cos(a) * (R - 16) + 4} textAnchor="middle" fontSize="11" fill="#3f3f46">
              {pad(i * 5)}
            </text>
          );
        })}
        <line x1={C} y1={C} x2={hx} y2={hy} stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={hx} cy={hy} r="13" fill="var(--brand)" />
        <text x={hx} y={hy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
          {pad(minute)}
        </text>
        <circle cx={C} cy={C} r="4" fill="var(--brand)" />
      </svg>
      <div className="flex items-center gap-2">
        <Chip active={false} onClick={() => onChange((minute + 59) % 60)} aria-label={`${label} 1분 빼기`}>
          − 1분
        </Chip>
        <span className="w-12 text-center text-lg font-bold tabular-nums">:{pad(minute)}</span>
        <Chip active={false} onClick={() => onChange((minute + 1) % 60)} aria-label={`${label} 1분 더하기`}>
          + 1분
        </Chip>
        <Chip active onClick={onDone}>
          완료
        </Chip>
      </div>
    </div>
  );
}

function Chip({ active, children, className = "", ...props }: { active: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`${className} whitespace-nowrap rounded-lg border px-1.5 py-1.5 text-sm transition-colors ${
        active ? "border-brand bg-brand font-semibold text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-brand-soft"
      }`}
    >
      {children}
    </button>
  );
}
