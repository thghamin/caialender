// 기존 일정과 새 공지에서 추출한 일정을 비교해 바뀐 항목을 찾는다 (순수 함수)
import { formatKst, kstDate } from "../datetime";
import type { ExtractedEvent } from "./extract-schema";

type Comparable = Pick<
  ExtractedEvent,
  "title" | "start_at" | "end_at" | "all_day" | "location" | "target_grades" | "description"
>;

export type FieldChange = {
  field: "start_at" | "end_at" | "location" | "target_grades";
  before: unknown;
  after: unknown;
};

const FIELD_LABEL: Record<FieldChange["field"], string> = {
  start_at: "일시",
  end_at: "종료",
  location: "장소",
  target_grades: "대상 학년",
};

export function diffEvent(before: Comparable, after: Comparable): FieldChange[] {
  const changes: FieldChange[] = [];

  // 새 공지가 시각 없이 날짜만 말한 경우, 같은 날이면 변경으로 보지 않는다
  const sameStart =
    after.all_day && !before.all_day
      ? kstDate(before.start_at) === kstDate(after.start_at)
      : new Date(before.start_at).getTime() === new Date(after.start_at).getTime();
  if (!sameStart) changes.push({ field: "start_at", before: before.start_at, after: after.start_at });

  // 새 공지에서 언급하지 않은 정보(null)는 '삭제'가 아니라 '언급 없음'으로 본다
  if (after.end_at && (!before.end_at || new Date(after.end_at).getTime() !== new Date(before.end_at).getTime())) {
    changes.push({ field: "end_at", before: before.end_at, after: after.end_at });
  }
  if (after.location && normalize(after.location) !== normalize(before.location)) {
    changes.push({ field: "location", before: before.location, after: after.location });
  }
  if (after.target_grades.length && after.target_grades.join() !== before.target_grades.join()) {
    changes.push({ field: "target_grades", before: before.target_grades, after: after.target_grades });
  }
  return changes;
}

export function summarizeChanges(title: string, changes: FieldChange[]) {
  const parts = changes.map((c) => `${FIELD_LABEL[c.field]}: ${show(c.field, c.before)} → ${show(c.field, c.after)}`);
  return `「${title}」 ${parts.join(", ")}`;
}

function show(field: FieldChange["field"], v: unknown) {
  if (v == null) return "없음";
  if (field === "start_at" || field === "end_at") return formatKst(String(v));
  if (field === "target_grades") return (v as number[]).length ? `${(v as number[]).join("·")}학년` : "전체";
  return String(v);
}

function normalize(s: string | null) {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}
