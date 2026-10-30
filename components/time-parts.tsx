"use client";

import { useRef } from "react";

// 시간 고르기 공용 부품: 버튼 칩, 오전/오후·시 선택, 분 시계(드래그)
// 개인 일정은 :00/:30 버튼, 내 시간표는 5분 단위 시계로 분을 고른다.

export type Clock = { ampm: "am" | "pm"; hour: number; minute: number }; // hour 1~12

const pad = (n: number) => String(n).padStart(2, "0");
export const clockLabel = (c: Clock) => `${c.ampm === "am" ? "오전" : "오후"} ${c.hour}:${pad(c.minute)}`;
export const toMinutes = (c: Clock) => (c.ampm === "am" ? c.hour % 12 : (c.hour % 12) + 12) * 60 + c.minute;
export const fromMinutes = (m: number): Clock => {
  const mm = ((m % 1440) + 1440) % 1440;
  const h24 = Math.floor(mm / 60);
  return { ampm: h24 < 12 ? "am" : "pm", hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: mm % 60 };
};

/** 오전/오후 두 버튼 + 12·1~11시 버튼 */
export function AmPmHourPicker({ label, value, onChange }: { label: string; value: Clock; onChange: (c: Clock) => void }) {
  return (
    <>
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
    </>
  );
}

/** 시계 모양 분 선택: 바늘을 끌거나 원을 눌러서 고르고, ± 버튼으로 step분씩 조정. step=5면 5분 단위 눈금만 보인다 */
export function MinuteDial({ label, minute, onChange, onDone, step = 1 }: {
  label: string;
  minute: number;
  onChange: (m: number) => void;
  onDone?: () => void;
  step?: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const R = 80;
  const C = 100;

  const pick = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 200 - C;
    const y = ((clientY - box.top) / box.height) * 200 - C;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI; // 12시 방향 0도, 시계 방향
    onChange(((Math.round(((deg + 360) % 360) / (6 * step)) * step) + 60) % 60);
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
        aria-valuemax={60 - step}
        aria-valuenow={minute}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((minute + step) % 60);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((minute + 60 - step) % 60);
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
        {Array.from({ length: 60 / step }, (_, j) => {
          const i = j * step;
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
        <Chip active={false} onClick={() => onChange((minute + 60 - step) % 60)} aria-label={`${label} ${step}분 빼기`}>
          − {step}분
        </Chip>
        <span className="w-12 text-center text-lg font-bold tabular-nums">:{pad(minute)}</span>
        <Chip active={false} onClick={() => onChange((minute + step) % 60)} aria-label={`${label} ${step}분 더하기`}>
          + {step}분
        </Chip>
        {onDone && (
          <Chip active onClick={onDone}>
            완료
          </Chip>
        )}
      </div>
    </div>
  );
}

export function Chip({ active, children, className = "", ...props }: { active: boolean } & React.ComponentProps<"button">) {
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
