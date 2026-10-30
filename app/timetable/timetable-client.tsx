"use client";

import { useRef, useState, useTransition } from "react";
import { TimetableGrid } from "@/components/timetable-grid";
import { AmPmHourPicker, Chip, MinuteDial, fromMinutes, toMinutes } from "@/components/time-parts";
import { COURSE_COLORS, DAY_LABELS, hhmm, koreanTime, type TimetableCourse, type TimetableSlot } from "@/lib/timetable";
import { shrinkImage } from "@/lib/client/shrink-image";
import { analyzeTimetableImage, deleteCourse, importCourses, saveCourse, setCourseReminder } from "./actions";

type Keyed = TimetableCourse & { key: string };
type Sheet = { mode: "edit"; draft: Keyed } | { mode: "import" } | null;

const newSlot = (day = 0, start = 9 * 60): TimetableSlot => ({ day, start_min: start, end_min: start + 75, location: null });

export function TimetableClient({ initial }: { initial: Keyed[] }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const courses = initial;

  const openNew = () =>
    setSheet({
      mode: "edit",
      draft: { key: "new", name: "", professor: null, color: courses.length % COURSE_COLORS.length, reminder: false, slots: [newSlot()] },
    });
  const openEdit = (key: string) => {
    const c = courses.find((x) => x.key === key);
    if (c) setSheet({ mode: "edit", draft: structuredClone(c) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={openNew} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-dark">
          + 수업 추가
        </button>
        <button onClick={() => setSheet({ mode: "import" })} className="rounded-full border border-brand/40 bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
          📷 에타 시간표 가져오기 (AI)
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-white/70 p-6 text-center text-sm text-zinc-500">
          아직 시간표가 없어요. <b>+ 수업 추가</b>로 직접 넣거나, 에브리타임 시간표를 캡처해서 <b>📷 에타 시간표 가져오기</b>를 눌러 보세요.
        </div>
      ) : (
        <TimetableGrid courses={courses} onSelect={openEdit} />
      )}

      {courses.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {courses.map((c) => (
            <li key={c.key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="size-3 shrink-0 rounded-full" style={{ background: COURSE_COLORS[c.color % COURSE_COLORS.length] }} />
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(c.key)}>
                <p className="truncate text-sm font-semibold">
                  {c.name} {c.professor && <span className="font-normal text-zinc-500">· {c.professor}</span>}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {c.slots.map((s) => `${DAY_LABELS[s.day]} ${hhmm(s.start_min)}-${hhmm(s.end_min)}${s.location ? ` ${s.location}` : ""}`).join(" / ")}
                </p>
              </button>
              <CourseReminderSwitch id={c.id!} initial={c.reminder} name={c.name} />
            </li>
          ))}
        </ul>
      )}

      {sheet?.mode === "edit" && <CourseSheet key={`${sheet.draft.key}-${sheet.draft.name}`} draft={sheet.draft} others={courses.filter((c) => c.key !== sheet.draft.key)} onClose={() => setSheet(null)} />}
      {sheet?.mode === "import" && <ImportSheet hasExisting={courses.length > 0} onClose={() => setSheet(null)} />}
    </div>
  );
}

function CourseReminderSwitch({ id, initial, name }: { id: string; initial: boolean; name: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={`${name} 10분 전 알림`}
      title="수업 10분 전 알림"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!(await setCourseReminder(id, !on)).error) setOn(!on);
        })
      }
      className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 disabled:opacity-50"
    >
      <span>{on ? "🔔" : "🔕"} 10분 전</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-brand" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** 바닥(휴대폰)·가운데(PC)에 뜨는 시트 */
function SheetFrame({ title, onClose, action, children }: {
  title: string;
  onClose: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <button onClick={onClose} aria-label="닫기" className="text-2xl leading-none text-zinc-500">
            ×
          </button>
          <h2 className="font-bold">{title}</h2>
          <div className="min-w-12 text-right">{action}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

/** 에브리타임 '수업 추가'와 같은 형식: 수업명, 교수명, 요일·시간·장소(여러 개) */
function CourseSheet({ draft, others, onClose }: { draft: Keyed; others: Keyed[]; onClose: () => void }) {
  const [c, setC] = useState<Keyed>(draft);
  const [openSlot, setOpenSlot] = useState<number | null>(draft.key === "new" ? 0 : null);
  const [error, setError] = useState<string>();
  // 저장 후 시트를 바로 닫기 위해 transition 대신 일반 상태를 쓴다 (transition 안의 닫기는 새로고침이 끝날 때까지 미뤄진다)
  const [pending, setPending] = useState(false);
  const run = async (fn: () => Promise<{ error?: string }>) => {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (r.error) setError(r.error);
    else onClose();
  };
  const editing = draft.key !== "new";

  const setSlot = (i: number, patch: Partial<TimetableSlot>) => setC({ ...c, slots: c.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const save = () => run(() => saveCourse({ ...c, professor: c.professor?.trim() || null }));

  return (
    <SheetFrame
      title={editing ? "수업 수정" : "수업 추가"}
      onClose={onClose}
      action={
        <button onClick={save} disabled={pending} className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "저장 중" : "완료"}
        </button>
      }
    >
      <div className="max-h-56 overflow-y-auto">
        <TimetableGrid courses={[...others, c]} highlight={c.key} compact />
      </div>

      <div className="mt-4 flex flex-col">
        <input
          aria-label="수업명"
          placeholder="수업명"
          value={c.name}
          maxLength={60}
          onChange={(e) => setC({ ...c, name: e.target.value })}
          className="border-b border-zinc-200 py-3 text-base outline-none placeholder:text-zinc-400 focus:border-brand"
        />
        <input
          aria-label="교수명"
          placeholder="교수명"
          value={c.professor ?? ""}
          maxLength={40}
          onChange={(e) => setC({ ...c, professor: e.target.value })}
          className="border-b border-zinc-200 py-3 text-base outline-none placeholder:text-zinc-400 focus:border-brand"
        />

        {c.slots.map((s, i) => (
          <div key={i} className="border-b border-zinc-200 py-2" data-testid="slot-row">
            <div className="flex flex-wrap items-center gap-3 py-1.5 text-base">
              <label className="flex items-center gap-1">
                <select
                  aria-label={`시간 ${i + 1} 요일`}
                  value={s.day}
                  onChange={(e) => setSlot(i, { day: Number(e.target.value) })}
                  className="appearance-none bg-transparent pr-1 outline-none"
                >
                  {DAY_LABELS.map((d, day) => (
                    <option key={d} value={day}>
                      {d}요일
                    </option>
                  ))}
                </select>
                <span className="text-brand">▾</span>
              </label>
              <button type="button" onClick={() => setOpenSlot(openSlot === i ? null : i)} aria-expanded={openSlot === i} aria-label={`시간 ${i + 1} 시각`} className="flex items-center gap-1">
                {hhmm(s.start_min)} - {hhmm(s.end_min)} <span className="text-brand">▾</span>
              </button>
            </div>
            {openSlot === i && (
              <TimeRangePicker slot={s} label={`시간 ${i + 1}`} onChange={(start_min, end_min) => setSlot(i, { start_min, end_min })} onDone={() => setOpenSlot(null)} />
            )}
            <div className="flex items-center gap-2">
              <input
                aria-label={`시간 ${i + 1} 장소`}
                placeholder="장소"
                value={s.location ?? ""}
                maxLength={80}
                onChange={(e) => setSlot(i, { location: e.target.value })}
                className="flex-1 py-2 text-base outline-none placeholder:text-zinc-400"
              />
              {c.slots.length > 1 && (
                <button type="button" aria-label={`시간 ${i + 1} 지우기`} onClick={() => setC({ ...c, slots: c.slots.filter((_, j) => j !== i) })} className="px-1 text-lg text-zinc-500">
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const last = c.slots.at(-1);
            // 다음 요일, 같은 시각·같은 길이로 (주 2회 수업이 많다)
            const slot = last
              ? { day: Math.min(last.day + 1, 6), start_min: last.start_min, end_min: last.end_min, location: last.location }
              : newSlot();
            setC({ ...c, slots: [...c.slots, slot] });
            setOpenSlot(c.slots.length);
          }}
          className="py-3 text-left text-base font-semibold text-brand"
        >
          시간 및 장소 추가
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="text-zinc-500">칸 색</span>
          {COURSE_COLORS.map((col, i) => (
            <button
              key={col}
              type="button"
              aria-label={`색 ${i + 1}`}
              aria-pressed={c.color === i}
              onClick={() => setC({ ...c, color: i })}
              className={`size-6 rounded-full border-2 ${c.color === i ? "border-brand" : "border-white"} shadow-sm`}
              style={{ background: col }}
            />
          ))}
        </div>
        <label className="flex items-center justify-between py-2 text-sm">
          <span>🔔 수업 10분 전 알림</span>
          <input type="checkbox" checked={c.reminder} onChange={(e) => setC({ ...c, reminder: e.target.checked })} className="size-5 accent-brand" />
        </label>
        {error && <p className="py-2 text-sm text-red-600">{error}</p>}
        {editing && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`'${c.name}' 수업을 시간표에서 지울까요?`)) run(() => deleteCourse(c.id!));
            }}
            className="mt-4 py-2 text-sm text-red-600"
          >
            수업 삭제
          </button>
        )}
      </div>
    </SheetFrame>
  );
}

/** 시작·종료 시각: 오전/오후 → 시 → 분(5분 단위 시계로만) */
function TimeRangePicker({ slot, label, onChange, onDone }: {
  slot: TimetableSlot;
  label: string;
  onChange: (start: number, end: number) => void;
  onDone: () => void;
}) {
  const [which, setWhich] = useState<"start" | "end">("start");
  const value = fromMinutes(which === "start" ? slot.start_min : slot.end_min);
  const set = (min: number) => {
    if (which === "start") {
      const len = slot.end_min - slot.start_min;
      onChange(min, Math.min(min + Math.max(len, 5), 1440));
    } else {
      onChange(slot.start_min, min <= slot.start_min ? slot.start_min + 5 : min);
    }
  };
  const who = `${label} ${which === "start" ? "시작" : "종료"}`;

  return (
    <div className="mb-2 flex flex-col gap-2 rounded-xl bg-zinc-50 p-3">
      <div className="grid grid-cols-2 gap-1.5 text-sm" role="tablist">
        {(["start", "end"] as const).map((w) => (
          <Chip key={w} active={which === w} role="tab" aria-selected={which === w} onClick={() => setWhich(w)}>
            {w === "start" ? "시작" : "종료"} {koreanTime(w === "start" ? slot.start_min : slot.end_min)}
          </Chip>
        ))}
      </div>
      <AmPmHourPicker label={who} value={value} onChange={(c) => set(toMinutes(c))} />
      <MinuteDial label={who} minute={value.minute} step={5} onChange={(m) => set(toMinutes({ ...value, minute: m }))} onDone={onDone} />
    </div>
  );
}

/** 에브리타임 시간표 스크린샷 → AI가 읽기 → 확인 → 시간표에 추가 */
function ImportSheet({ hasExisting, onClose }: { hasExisting: boolean; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [file, setFile] = useState<File>();
  const [drag, setDrag] = useState(false);
  const pick = (f: File | undefined) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : undefined);
    setResult(null);
  };
  const [result, setResult] = useState<Keyed[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string>();
  const [analyzing, startAnalyze] = useTransition();
  const [saving, setSaving] = useState(false);

  const analyze = () =>
    startAnalyze(async () => {
      setError(undefined);
      if (!file) return setError("시간표 스크린샷을 먼저 골라 주세요.");
      const fd = new FormData();
      fd.set("image", await shrinkImage(file));
      const r = await analyzeTimetableImage(fd);
      if (r.error || !r.courses) return setError(r.error ?? "시간표를 읽지 못했어요.");
      const keyed = r.courses.map((c, i) => ({ ...c, key: `ai-${i}` }));
      setResult(keyed);
      setPicked(new Set(keyed.map((c) => c.key)));
    });

  const save = async () => {
    {
      const list: TimetableCourse[] = (result ?? []).filter((c) => picked.has(c.key)).map((c) => ({ name: c.name, professor: c.professor, color: c.color, reminder: c.reminder, slots: c.slots }));
      if (!list.length) return setError("추가할 수업을 하나 이상 골라 주세요.");
      setSaving(true);
      const r = await importCourses(list, replace);
      setSaving(false);
      if (r.error) setError(r.error);
      else onClose();
    }
  };

  return (
    <SheetFrame
      title="에타 시간표 가져오기"
      onClose={onClose}
      action={
        result && (
          <button onClick={save} disabled={saving} className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "저장 중" : "추가"}
          </button>
        )
      }
    >
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>에브리타임 앱에서 시간표 화면을 캡처하세요. 요일과 시간 눈금이 보이게 찍으면 정확해요.</li>
        <li>아래에서 캡처한 사진을 고르고 <b>AI로 읽기</b>를 누르세요.</li>
        <li>AI가 읽은 결과를 확인하고 <b>추가</b>를 누르면 시간표에 들어가요. 틀린 곳은 추가한 뒤 칸을 눌러 고칠 수 있어요.</li>
      </ol>
      {/* 공지 등록과 같은 첨부 상자: 파일 선택 버튼 + 끌어다 놓기 + 미리보기 */}
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">에타 시간표 스크린샷 (PNG·JPG·WEBP)</span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (!f || !["image/png", "image/jpeg", "image/webp"].includes(f.type) || !input.current) return;
            const dt = new DataTransfer();
            dt.items.add(f);
            input.current.files = dt.files;
            pick(f);
          }}
          className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
            drag ? "border-brand bg-brand-soft" : "border-zinc-300 bg-zinc-50"
          }`}
        >
          <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white shadow-sm hover:bg-zinc-900">
            📎 파일 선택
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="에타 시간표 스크린샷"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {preview && file ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL) */}
              <img src={preview} alt="선택한 시간표 스크린샷" className="h-16 w-16 rounded-md object-cover ring-1 ring-zinc-200" />
              <div>
                <p className="max-w-48 truncate font-medium">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (input.current) input.current.value = "";
                  pick(undefined);
                }}
                className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200"
              >
                ✕ 빼기
              </button>
            </div>
          ) : (
            <span className="text-zinc-500">또는 스크린샷을 여기로 끌어다 놓으세요</span>
          )}
        </div>
      </div>
      <button
        onClick={analyze}
        disabled={analyzing || !preview}
        className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {analyzing ? "🤖 AI가 시간표를 읽고 있어요… (20~40초)" : "🤖 AI로 읽기"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">AI가 읽은 수업 {result.length}개 — 넣을 수업을 고르세요</p>
          <TimetableGrid courses={result.filter((c) => picked.has(c.key))} compact />
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {result.map((c) => (
              <li key={c.key}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-brand"
                    checked={picked.has(c.key)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(c.key);
                      else next.delete(c.key);
                      setPicked(next);
                    }}
                  />
                  <span className="min-w-0 text-sm">
                    <b>{c.name}</b> {c.professor && <span className="text-zinc-500">· {c.professor}</span>}
                    <span className="block text-xs text-zinc-500">
                      {c.slots.map((s) => `${DAY_LABELS[s.day]} ${hhmm(s.start_min)}-${hhmm(s.end_min)}${s.location ? ` ${s.location}` : ""}`).join(" / ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {hasExisting && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="size-4 accent-brand" />
              지금 시간표를 지우고 이걸로 바꾸기
            </label>
          )}
        </div>
      )}
    </SheetFrame>
  );
}
