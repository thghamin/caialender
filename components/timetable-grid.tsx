"use client";

import { COURSE_COLORS, DAY_LABELS, gridRange, hhmm, type TimetableCourse } from "@/lib/timetable";

/**
 * 에브리타임처럼 요일(열) × 시간(행) 시간표. 수업 칸에는 과목명·교수명·강의실.
 * highlightKey가 있는 과목은 테두리로 강조한다(추가·수정 중인 과목).
 */
export function TimetableGrid({ courses, onSelect, highlight, compact = false }: {
  courses: (TimetableCourse & { key: string })[];
  onSelect?: (key: string) => void;
  highlight?: string;
  compact?: boolean;
}) {
  const { days, startHour, endHour } = gridRange(courses);
  const rowH = compact ? 40 : 56; // 1시간 높이(px)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white" data-testid="timetable-grid">
      {/* 요일 머리 */}
      <div className="grid border-b border-zinc-200 text-center text-xs text-zinc-500" style={{ gridTemplateColumns: `22px repeat(${days}, 1fr)` }}>
        <div />
        {DAY_LABELS.slice(0, days).map((d) => (
          <div key={d} className="border-l border-zinc-100 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `22px repeat(${days}, 1fr)` }}>
        {/* 시간 눈금: 에타처럼 12시 다음은 1, 2, 3 … */}
        <div>
          {hours.map((h) => (
            <div key={h} className="border-b border-zinc-100 pr-1 pt-0.5 text-right text-[10px] text-zinc-400" style={{ height: rowH }}>
              {h % 12 === 0 ? 12 : h % 12}
            </div>
          ))}
        </div>
        {DAY_LABELS.slice(0, days).map((d, day) => (
          <div key={d} className="relative border-l border-zinc-100">
            {hours.map((h) => (
              <div key={h} className="border-b border-zinc-100" style={{ height: rowH }} />
            ))}
            {courses.flatMap((c) =>
              c.slots
                .filter((s) => s.day === day)
                .map((s, i) => {
                  const top = ((s.start_min - startHour * 60) / 60) * rowH;
                  const height = Math.max(((s.end_min - s.start_min) / 60) * rowH, 18);
                  return (
                    <button
                      key={`${c.key}-${i}-${s.start_min}`}
                      type="button"
                      onClick={() => onSelect?.(c.key)}
                      title={`${c.name}${c.professor ? ` · ${c.professor}` : ""}\n${hhmm(s.start_min)}~${hhmm(s.end_min)}${s.location ? ` · ${s.location}` : ""}`}
                      className={`absolute inset-x-0 overflow-hidden px-1 py-0.5 text-left text-zinc-800 transition-[filter] hover:brightness-95 ${
                        highlight === c.key ? "z-10 ring-2 ring-brand ring-inset" : ""
                      }`}
                      style={{ top, height, background: COURSE_COLORS[c.color % COURSE_COLORS.length] }}
                    >
                      <span className={`block font-semibold leading-tight ${compact ? "text-[10px]" : "text-[12px]"}`}>{c.name}</span>
                      {!compact && c.professor && <span className="block truncate text-[10.5px] leading-tight text-zinc-600">{c.professor}</span>}
                      {s.location && (
                        <span className={`block leading-tight text-zinc-600 ${compact ? "truncate text-[9px]" : "text-[10.5px]"}`}>{s.location}</span>
                      )}
                    </button>
                  );
                }),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
