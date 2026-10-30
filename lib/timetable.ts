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
  required: ["courses"],
  additionalProperties: false,
} as const;

export const TIMETABLE_SYSTEM_PROMPT = `너는 대학생 시간표 앱 '에브리타임'의 시간표 스크린샷을 읽어 수업 목록을 만든다.
규칙:
1. 표의 맨 위 줄이 요일(월 화 수 목 금, 있으면 토 일)이고, 왼쪽 세로 숫자가 시각이다. 9, 10, 11, 12 다음의 1, 2, 3 … 은 오후(13시, 14시, 15시 …)다.
2. 색칠된 칸 하나가 수업 한 번이다. 칸 안 글자는 위에서부터 과목명, 교수명, 강의실(장소) 순서다. 강의실이 "산격동 캠퍼스 복현회관-308"처럼 길면 그대로 적는다. 칸이 잘려 일부만 보이면 보이는 글자만 적는다.
3. 요일은 칸의 가로 위치로 정한다. 칸의 왼쪽·오른쪽 끝을 맨 위 요일 머리와 세로로 맞춰 보고, 바로 위 칸의 요일을 따라 하지 마라.
4. 칸의 위쪽 끝이 시작 시각, 아래쪽 끝이 종료 시각이다. 시간 눈금 한 칸(1시간) 높이를 기준으로 칸 아래 끝이 눈금 사이 어디쯤인지 보고 5분 단위로 맞춘다(1/4 지점=15분, 절반=30분, 3/4=45분). 대학 수업은 75분(1시간 15분)·50분·2시간짜리가 많다. "HH:mm" 24시간제로 쓴다.
5. 화면 아래나 옆에서 잘려 끝이 보이지 않는 칸은 보이는 시작 시각부터 1시간으로 둔다.
6. 같은 과목명·교수명이 여러 요일이나 여러 칸에 있으면 과목 하나에 slots를 여러 개 둔다.
7. 보이지 않는 수업을 지어내지 마라. 교수명이나 강의실이 없으면 null.`;

const aiSlot = z.object({ day: z.string(), start: z.string(), end: z.string(), location: z.string().nullable().optional() });
const aiCourse = z.object({ name: z.string(), professor: z.string().nullable().optional(), slots: z.array(z.unknown()) });

/** AI 결과를 검증·정규화. 이상한 칸은 버린다 */
export function normalizeTimetable(raw: unknown): { courses: TimetableCourse[]; dropped: string[] } {
  const dropped: string[] = [];
  const list = z.object({ courses: z.array(z.unknown()) }).safeParse(raw);
  if (!list.success) return { courses: [], dropped: ["응답 형식이 올바르지 않음"] };

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
      const start = p.success ? parseHhmm(p.data.start) : null;
      const end = p.success ? parseHhmm(p.data.end) : null;
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
  return { courses, dropped };
}
