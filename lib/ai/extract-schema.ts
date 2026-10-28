// 공지 → 일정 추출: 프롬프트, JSON 스키마, 결과 정규화 (순수 함수, 테스트 대상)
import { z } from "zod";
import { formatKst, kstDate, kstToIso } from "../datetime";
import type { EventKind } from "../types";

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["event", "deadline", "other"] },
          start: { type: "string", description: "YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm (KST)" },
          end: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          target_grades: { type: "array", items: { type: "integer" } },
          target_note: { type: ["string", "null"] },
          description: { type: "string" },
          missing_fields: { type: "array", items: { type: "string" } },
          existing_event_id: { type: ["string", "null"] },
        },
        required: [
          "title", "kind", "start", "end", "location",
          "target_grades", "target_note", "description", "missing_fields", "existing_event_id",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
} as const;

const rawEventSchema = z.object({
  title: z.string(),
  kind: z.string(),
  start: z.string(),
  end: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  target_grades: z.array(z.number()).optional().default([]),
  target_note: z.string().nullable().optional(),
  description: z.string().optional().default(""),
  missing_fields: z.array(z.string()).optional().default([]),
  existing_event_id: z.string().nullable().optional(),
});

export const rawExtractionSchema = z.object({ events: z.array(z.unknown()) });

export type ExtractedEvent = {
  title: string;
  kind: EventKind;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  target_grades: number[];
  target_note: string | null;
  description: string;
  missing_fields: string[];
  /** 이 공지가 기존 일정의 변경·재공지라고 AI가 판단한 경우 그 일정 id */
  existing_event_id: string | null;
};

export function buildExtractionSystemPrompt(today: string) {
  return `너는 대학 학과(경북대 인공지능전공) 공지에서 캘린더 일정을 추출한다. 오늘은 ${today}(한국 시간)이다.
규칙:
1. 공지 하나에 날짜가 여러 개면 각각 별도 일정으로 만든다. 특히 "신청/접수/제출 ~까지", "~까지 연락" 같은 마감은 반드시 kind="deadline"인 별도 일정으로 만들고 제목은 "OOO 신청 마감"처럼 쓴다.
2. 행사·수업·모임 자체는 kind="event", 그 밖의 안내는 "other".
3. 시각이 적혀 있으면 "YYYY-MM-DDTHH:mm"(24시간제), 없으면 "YYYY-MM-DD". "23:59까지"처럼 마감 시각이 있으면 그 시각을 쓴다. 집결 시각도 시작 시각으로 본다. "21:35~21:55", "오후 4시~6시"처럼 시각 범위가 있으면 end에 종료 시각을 반드시 쓴다.
4. 연도가 없으면 공지 게시일 이후(같은 날 포함)로 가장 가까운 날짜를 고른다. 요일이 함께 적혀 있으면 요일이 맞는 연도를 고른다. "오늘", "내일", "이번 주 금요일" 같은 상대 표현은 공지 게시 시각을 기준으로 계산한다.
5. 공지에 없는 종료 시각을 지어내지 마라(end=null). 여러 날 행사는 end에 마지막 날짜를 쓴다.
6. target_grades는 공지에 학년이나 학번이 명시된 경우에만 채운다: 신입생·새내기·27학번=[1], "2~4학년"=[2,3,4], "신입생 제외 재학생"=[2,3,4]. "재학생", "재적생", "전공생", "6단대 재적생", "희망자"처럼 학년 구분이 없으면 []. target_note에 대상 원문을 그대로 적는다.
7. 공지에 없는 정보는 지어내지 말고 null로 두고, 학생이 알아야 하는데 빠진 정보를 missing_fields에 한국어로 적는다(예: "장소", "시간", "신청 방법").
8. description에는 참가비, 준비물, 신청 링크 등 핵심 정보를 1~3문장으로 요약한다.
9. 날짜가 전혀 없는 공지면 events는 빈 배열이다.
10. 사용자 메시지에 "기존 일정 목록"이 주어진다. 추출한 일정이 그중 하나와 같은 행사·마감(일정 변경, 장소 변경, 재공지, 마감 연장 등)이면 existing_event_id에 그 id를 쓰고, 새 일정이면 null로 둔다. 목록에 없는 id를 만들지 마라.
예) "MT 3/5(금) 강당 집결, 신청은 2/28까지" → [{title:"MT", kind:"event", start:"YYYY-03-05", location:"강당", missing_fields:["시간"]}, {title:"MT 신청 마감", kind:"deadline", start:"YYYY-02-28", location:null, missing_fields:["신청 방법"]}]`;
}

/** 분석 요청의 사용자 메시지 본문 (서비스와 평가 테스트가 같은 형식을 쓰도록 공통화) */
export function buildExtractionUserText(
  notice: { title: string; body: string; posted_at: string },
  existing: { id: string; kind: string; start_at: string; all_day: boolean; title: string; location: string | null }[],
) {
  return [
    `공지 게시 시각: ${formatKst(notice.posted_at)}`,
    `제목: ${notice.title}`,
    notice.body ? `본문:\n${notice.body}` : "본문 없음 (첨부 포스터 이미지를 읽어라)",
    "",
    "기존 일정 목록 (id | 종류 | 날짜 | 제목 | 장소):",
    existing.length
      ? existing.map((e) => `${e.id} | ${e.kind} | ${formatKst(e.start_at, !e.all_day)} | ${e.title} | ${e.location ?? "-"}`).join("\n")
      : "(없음)",
  ].join("\n");
}

const KINDS: EventKind[] = ["event", "deadline", "other"];
const DAY = 86400_000;

function shiftYear(value: string, years: number) {
  return value.replace(/^(\d{4})/, (y) => String(Number(y) + years));
}
const GRADE_HINT = /학년|학번|신입|새내기|새터|저학년|고학년|졸업/;

/** AI 원본 결과를 검증·정규화. 잘못된 항목은 버리고 이유를 남긴다 */
export function normalizeExtraction(
  raw: unknown,
  knownEventIds: ReadonlySet<string> = new Set(),
  postedAt?: string,
): { events: ExtractedEvent[]; dropped: string[] } {
  const parsed = rawExtractionSchema.safeParse(raw);
  if (!parsed.success) return { events: [], dropped: ["응답 형식이 올바르지 않음"] };

  const events: ExtractedEvent[] = [];
  const dropped: string[] = [];

  for (const item of parsed.data.events) {
    const r = rawEventSchema.safeParse(item);
    if (!r.success) {
      dropped.push("필수 항목 누락");
      continue;
    }
    const e = r.data;
    const title = e.title.trim();
    let start = kstToIso(e.start);
    let endRaw = e.end ?? null;
    // AI가 연도 없는 날짜를 이미 지난 해로 잡은 경우(게시일보다 30일 넘게 이전) 다음 해로 보정
    if (start && postedAt) {
      const posted = new Date(postedAt).getTime();
      const shifted = kstToIso(shiftYear(e.start, 1));
      if (
        new Date(start.iso).getTime() < posted - 30 * DAY &&
        shifted &&
        new Date(shifted.iso).getTime() >= posted - 30 * DAY &&
        new Date(shifted.iso).getTime() < posted + 365 * DAY
      ) {
        start = shifted;
        if (endRaw) endRaw = shiftYear(endRaw, 1);
      }
    }
    if (!title || !start) {
      dropped.push(`날짜 해석 실패: ${title || "(제목 없음)"} / ${e.start}`);
      continue;
    }
    let end = kstToIso(endRaw);
    // 시작은 시각이 있는데 종료는 날짜만 있으면(여러 날 행사) 그날 23:59까지로 본다
    if (end && !end.hasTime && start.hasTime) {
      end = kstToIso(`${kstDate(end.iso)}T23:59`);
    }
    // 종일 일정의 end는 그날 끝까지 포함되도록 그대로 두고, 시작보다 앞서면 버린다
    if (end && end.iso < start.iso) end = null;
    // 마감과 동일한 end는 의미 없음
    if (end && end.iso === start.iso) end = null;

    const missing = new Set(e.missing_fields.map((s) => s.trim()).filter(Boolean));
    if (start.hasTime) missing.delete("시간");
    if (e.location?.trim()) missing.delete("장소");

    const targetNote = e.target_note?.trim() || null;
    let grades = [...new Set(e.target_grades.filter((g) => Number.isInteger(g) && g >= 1 && g <= 4))].sort();
    // 대상 설명에 학년을 가리키는 말이 없는데 AI가 학년을 지정했다면 믿지 않는다 (예: "6단대 재적생" → 전체)
    if (grades.length && targetNote && !GRADE_HINT.test(targetNote)) grades = [];

    events.push({
      title: title.slice(0, 120),
      kind: KINDS.includes(e.kind as EventKind) ? (e.kind as EventKind) : "other",
      start_at: start.iso,
      end_at: end?.iso ?? null,
      all_day: !start.hasTime,
      location: e.location?.trim() || null,
      target_grades: grades,
      target_note: targetNote,
      description: e.description.trim(),
      missing_fields: [...missing],
      existing_event_id:
        e.existing_event_id && knownEventIds.has(e.existing_event_id) ? e.existing_event_id : null,
    });
  }
  return { events, dropped };
}

/** 같은 일정인지 판단하기 위한 키 (변경 탐지에 사용) */
export function eventKey(e: { title: string; kind: string; start_at: string }) {
  return `${e.kind}:${normalizeTitle(e.title)}`;
}

export function normalizeTitle(title: string) {
  return title.replace(/[\s\[\]()<>「」『』"'·,.!?~-]/g, "").toLowerCase();
}

export { kstDate };
