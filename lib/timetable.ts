// 내 시간표: 타입, 시간 계산, AI(에타 스크린샷) 결과 정규화 (순수 함수, 테스트 대상)
import { z } from "zod";

export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export type TimetableSlot = { id?: string; day: number; start_min: number; end_min: number; location: string | null };
export type TimetableCourse = {
  id?: string;
  name: string;
  professor: string | null;
  color: number;
  reminder: boolean;
  slots: TimetableSlot[];
  /** 가져오기 결과에서만: 사람이 확인해야 할 점 (예: 화면 아래가 잘려 끝 시각 추정) */
  check?: string;
};

// 에브리타임처럼 옅은 파스텔 칸 색 (글자는 진한 회색이라 어떤 색에서도 잘 보인다)
export const COURSE_COLORS = [
  "#f8d3d3",
  "#fbe3b8",
  "#f5eeb4",
  "#d3eccb",
  "#c9e4f5",
  "#dcd5f5",
  "#f5d2e6",
  "#d8ebc6",
  "#cde6ea",
  "#ecd9ca",
] as const;

export const pad2 = (n: number) => String(n).padStart(2, "0");
/** 분 → "09:05" */
export const hhmm = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
/** 분 → "오전 9:05" */
export function koreanTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${pad2(min % 60)}`;
}
/** "09:05" → 545 (5분 단위로 반올림) */
export function parseHhmm(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  if (min < 0 || min > 1440) return null;
  return Math.round(min / 5) * 5;
}

/** 시간표 그리드에 보일 요일 수(월~금, 주말 수업이 있으면 토·일까지)와 시간 범위 */
export function gridRange(courses: Pick<TimetableCourse, "slots">[]) {
  const slots = courses.flatMap((c) => c.slots);
  const days = slots.some((s) => s.day === 6) ? 7 : slots.some((s) => s.day === 5) ? 6 : 5;
  const startHour = Math.min(9, ...slots.map((s) => Math.floor(s.start_min / 60)));
  const endHour = Math.max(18, ...slots.map((s) => Math.ceil(s.end_min / 60)));
  return { days, startHour, endHour };
}

// ───────── AI: 에브리타임 시간표 스크린샷 → 수업 목록 ─────────

export const TIMETABLE_JSON_SCHEMA = {
  type: "object",
  properties: {
    grid_start_hour: { type: "integer", description: "시간표 왼쪽 세로 숫자 중 맨 위 숫자를 24시간제로 (보통 9)" },
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          professor: { type: ["string", "null"] },
          slots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string", enum: [...DAY_LABELS] },
                start: { type: "string", description: "HH:mm 24시간제" },
                end: { type: "string", description: "HH:mm 24시간제" },
                location: { type: ["string", "null"] },
              },
              required: ["day", "start", "end", "location"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "professor", "slots"],
        additionalProperties: false,
      },
    },
  },
  required: ["grid_start_hour", "courses"],
  additionalProperties: false,
} as const;

export const TIMETABLE_SYSTEM_PROMPT = `너는 대학생 시간표 앱 '에브리타임'의 시간표 스크린샷을 읽어 수업 목록을 만든다.
규칙:
1. 표의 맨 위 줄이 요일(월 화 수 목 금, 있으면 토 일)이고, 왼쪽 세로 숫자가 시각이다. 9, 10, 11, 12 다음의 1, 2, 3 … 은 오후(13시, 14시, 15시 …)다.
2. 색칠된 칸 하나가 수업 한 번이다. 칸 안 글자는 위에서부터 과목명, 교수명, 강의실(장소) 순서다. 강의실이 "산격동 캠퍼스 복현회관-308"처럼 길면 그대로 적는다. 칸이 잘려 일부만 보이면 보이는 글자만 적는다.
3. 요일은 칸의 가로 위치로 정한다. 칸의 왼쪽·오른쪽 끝을 맨 위 요일 머리와 세로로 맞춰 보고, 바로 위 칸의 요일을 따라 하지 마라.
4. 칸의 위쪽 끝이 시작 시각, 아래쪽 끝이 종료 시각이다. 시간 눈금 한 칸(1시간) 높이를 기준으로 칸 아래 끝이 눈금 사이 어디쯤인지 보고 5분 단위로 맞춘다(1/4 지점=15분, 절반=30분, 3/4=45분). 대학 수업은 75분(1시간 15분)·50분·2시간짜리가 많다. "HH:mm" 24시간제로 쓴다.
5. 화면 아래나 옆에서 잘려 끝이 보이지 않는 칸은 보이는 시작 시각부터 1시간으로 둔다.
8. grid_start_hour에는 왼쪽 시간 숫자 중 맨 위 숫자를 24시간제로 쓴다(예: 9, 8). 수업은 모두 30분 단위로 시작·끝난다.
6. 같은 과목명·교수명이 여러 요일이나 여러 칸에 있으면 과목 하나에 slots를 여러 개 둔다.
7. 보이지 않는 수업을 지어내지 마라. 교수명이나 강의실이 없으면 null.`;

const aiSlot = z.object({ day: z.string(), start: z.string(), end: z.string(), location: z.string().nullable().optional() });
const aiCourse = z.object({ name: z.string(), professor: z.string().nullable().optional(), slots: z.array(z.unknown()) });

/** AI 결과를 검증·정규화. 이상한 칸은 버린다 */
export function normalizeTimetable(raw: unknown): { courses: TimetableCourse[]; dropped: string[]; startHour: number | null } {
  const dropped: string[] = [];
  const list = z.object({ courses: z.array(z.unknown()) }).safeParse(raw);
  if (!list.success) return { courses: [], dropped: ["응답 형식이 올바르지 않음"], startHour: null };
  const sh = (raw as { grid_start_hour?: unknown }).grid_start_hour;
  const startHour = typeof sh === "number" && Number.isInteger(sh) && sh >= 5 && sh <= 12 ? sh : null;

  const courses: TimetableCourse[] = [];
  for (const item of list.data.courses) {
    const c = aiCourse.safeParse(item);
    if (!c.success || !c.data.name.trim()) {
      dropped.push("과목명 없음");
      continue;
    }
    const slots: TimetableSlot[] = [];
    for (const s of c.data.slots) {
      const p = aiSlot.safeParse(s);
      const day = p.success ? DAY_LABELS.indexOf(p.data.day.trim().slice(0, 1) as (typeof DAY_LABELS)[number]) : -1;
      // 수업은 모두 30분 단위로 시작·끝나므로 AI가 읽은 시각도 30분 단위로 맞춘다
      const r30 = (m: number | null) => (m === null ? null : Math.round(m / 30) * 30);
      const start = p.success ? r30(parseHhmm(p.data.start)) : null;
      const end = p.success ? r30(parseHhmm(p.data.end)) : null;
      if (!p.success || day < 0 || start === null || end === null || end <= start) {
        dropped.push(`${c.data.name}: 시간 해석 실패`);
        continue;
      }
      slots.push({ day, start_min: start, end_min: end, location: p.data.location?.trim() || null });
    }
    if (!slots.length) continue;
    // 같은 과목이 따로 나오면 합친다
    const name = c.data.name.trim().slice(0, 60);
    const professor = c.data.professor?.trim().slice(0, 40) || null;
    const same = courses.find((x) => x.name === name && x.professor === professor);
    if (same) same.slots.push(...slots);
    else courses.push({ name, professor, color: courses.length % COURSE_COLORS.length, reminder: false, slots });
  }
  return { courses, dropped, startHour };
}

// ───────── 칸별 글자 읽기: 칸마다 잘라 크게 키운 이미지를 AI에게 순서대로 준다 ─────────
export const BLOCK_TEXT_JSON_SCHEMA = {
  type: "object",
  properties: {
    start_hour: { type: "integer", description: "1번 이미지의 시간 숫자 (24시간제)" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          name: { type: "string" },
          professor: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
        },
        required: ["index", "name", "professor", "location"],
        additionalProperties: false,
      },
    },
  },
  required: ["start_hour", "blocks"],
  additionalProperties: false,
} as const;

export const BLOCK_TEXT_SYSTEM_PROMPT = `너는 에브리타임 시간표의 '수업 칸' 사진들에서 글자를 읽는다.
- 1번 이미지는 시간표 왼쪽 시간 숫자 칸의 맨 위 한 칸이다. 보이는 숫자를 start_hour에 24시간제로 쓴다(9 → 9, 1 → 13).
- 2번 이미지부터는 수업 칸 하나씩이다. index는 2번 이미지를 1로 시작해 차례대로 붙인다.
- 각 칸의 글자는 위에서부터 과목명, 교수명, 강의실(장소)이다. 과목명이 두 줄이면 이어 붙인다(예: "로봇운영체제" + "실습" → "로봇운영체제실습").
- 강의실은 "산격동 캠퍼스 복현회관-308"처럼 여러 줄이면 이어 붙이고, 칸 끝에서 잘린 글자는 보이는 만큼만 쓴다.
- 없는 정보는 null. 글자를 지어내지 마라.`;

const aiBlock = z.object({ index: z.number(), name: z.string(), professor: z.string().nullable().optional(), location: z.string().nullable().optional() });

/** 칸별로 읽은 글자 + 칸 시각 → 과목 목록 (같은 과목명·교수명은 하나로 묶는다) */
export function coursesFromBlocks(
  raw: unknown,
  blocks: { day: number; start_min: number; end_min: number; truncated?: boolean }[],
): { courses: TimetableCourse[]; startHour: number | null } {
  const parsed = z.object({ start_hour: z.number().optional(), blocks: z.array(z.unknown()) }).safeParse(raw);
  const texts = new Map<number, z.infer<typeof aiBlock>>();
  for (const b of parsed.success ? parsed.data.blocks : []) {
    const r = aiBlock.safeParse(b);
    if (r.success) texts.set(r.data.index, r.data);
  }
  const sh = parsed.success ? parsed.data.start_hour : undefined;
  const startHour = typeof sh === "number" && Number.isInteger(sh) && sh >= 5 && sh <= 12 ? sh : null;
  const courses: TimetableCourse[] = [];
  // AI가 빈칸을 "null", "없음" 같은 글자로 채우는 경우를 걸러낸다
  const clean = (v: string | null | undefined, max: number) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    return !t || /^(null|none|n\/a|없음|-|unknown|\?+)$/i.test(t) ? null : t.slice(0, max);
  };
  blocks.forEach((b, i) => {
    const t = texts.get(i + 1);
    const read = clean(t?.name, 60);
    const name = read ?? "수업 (이름 확인 필요)";
    const professor = clean(t?.professor, 40);
    const slot: TimetableSlot = { day: b.day, start_min: b.start_min, end_min: b.end_min, location: clean(t?.location, 80) };
    const same = courses.find((c) => c.name.replace(/\s/g, "") === name.replace(/\s/g, "") && c.professor === professor);
    const notes: string[] = [];
    if (!read) notes.push("이름을 읽지 못했어요");
    if (b.truncated) notes.push(`캡처 아래가 잘려 ${DAY_LABELS[b.day]}요일 끝나는 시각이 실제보다 이를 수 있어요`);
    if (same) {
      same.slots.push(slot);
      if (notes.length) same.check = [same.check, ...notes].filter(Boolean).join(" / ");
    } else {
      courses.push({ name, professor, color: courses.length % COURSE_COLORS.length, reminder: false, slots: [slot], check: notes.join(" / ") || undefined });
    }
  });
  return { courses, startHour };
}
