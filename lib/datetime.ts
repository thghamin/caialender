// 학과 일정은 모두 한국 시간(KST, UTC+9) 기준
export const KST_OFFSET = "+09:00";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/;

/** "2027-02-24" 또는 "2027-02-24T09:00" → KST 기준 ISO 문자열. 형식이 틀리면 null */
export function kstToIso(value: string | null | undefined): { iso: string; hasTime: boolean } | null {
  if (!value) return null;
  const v = value.trim();
  if (DATE_RE.test(v)) {
    const d = new Date(`${v}T00:00:00${KST_OFFSET}`);
    return isNaN(d.getTime()) ? null : { iso: d.toISOString(), hasTime: false };
  }
  const m = DATETIME_RE.exec(v);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00${KST_OFFSET}`);
    return isNaN(d.getTime()) ? null : { iso: d.toISOString(), hasTime: true };
  }
  return null;
}

/** ISO → "YYYY-MM-DD" (KST) */
export function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** ISO → "YYYY-MM-DDTHH:mm" (KST), datetime-local input 용 */
export function kstDateTime(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 사람이 읽는 형식: "2월 24일(수) 09:00" */
export function formatKst(iso: string, withTime = true): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]})`;
  if (!withTime) return base;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${base} ${hh}:${mm}`;
}

/** 요청 시점의 현재 시각(ms). 서버 컴포넌트는 요청마다 렌더링되므로 렌더 중 사용해도 된다 */
export function requestNow(): number {
  return Date.now();
}
