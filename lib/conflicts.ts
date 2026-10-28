// 일정 시간 충돌 확인 (순수 함수)

export type TimeRange = { id: string; title: string; start_at: string; end_at: string | null; all_day?: boolean };

const HOUR = 3600_000;

/** 일정의 실제 점유 구간. 종일 일정은 그날 하루, 종료 시각이 없으면 1시간으로 본다 */
export function span(e: TimeRange): [number, number] {
  const start = new Date(e.start_at).getTime();
  if (e.all_day) {
    const end = e.end_at ? new Date(e.end_at).getTime() : start;
    return [start, end + 24 * HOUR];
  }
  const end = e.end_at ? new Date(e.end_at).getTime() : start + HOUR;
  return [start, Math.max(end, start + 1)];
}

export function overlaps(a: TimeRange, b: TimeRange) {
  const [as, ae] = span(a);
  const [bs, be] = span(b);
  return as < be && bs < ae;
}

/** target과 겹치는 일정 목록. 종일 일정이나 마감은 시간 충돌로 보지 않는다 */
export function findConflicts<T extends TimeRange & { kind?: string }>(target: TimeRange, others: T[]): T[] {
  if (target.all_day) return [];
  return others.filter((o) => o.id !== target.id && !o.all_day && o.kind !== "deadline" && overlaps(target, o));
}
