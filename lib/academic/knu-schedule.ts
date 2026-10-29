// 경북대학교 학사일정 페이지(yearSchedule) HTML → 학사 캘린더 일정
// 서버 컴포넌트, 서버 액션, Node 스크립트(scripts/import-academic.mjs)에서 함께 쓰므로 의존성 없이 작성한다.

export const KNU_SCHEDULE_URL = (year: number) =>
  `https://www.knu.ac.kr/wbbs/wbbs/user/yearSchedule/index.action?menu_idx=43&vo.search_year=${year}`;

export type AcademicItem = {
  external_key: string;
  title: string;
  description: string;
  kind: "event" | "deadline" | "other";
  start_at: string; // ISO (KST 0시)
  end_at: string | null; // 종일 일정의 마지막 날 0시 (KST), 하루짜리는 null
  all_day: true;
  target_note: string | null;
};

const HOLIDAY_RE =
  /신정|삼일절|대체공휴일|연휴|어린이날|현충일|제헌절|광복절|개천절|한글날|성탄절|석가탄신일|근로자의 ?날|선거/;

// "(1.20.~1.22.)", ": 1.7.~1.8.", "(4.16. ~ 4.22.)", "12.28.~2027.1.5." 같은 기간 표기
const RANGE_RE = /(?:(\d{4})\.\s*)?(\d{1,2})\.\s*(\d{1,2})\.?\s*~\s*(?:(\d{4})\.\s*)?(\d{1,2})\.\s*(\d{1,2})\.?/;
// 제목 끝의 날짜 표기 "(1.1.)", "(1.20.~1.22.)", " : 1.7.~1.8." 를 지운다
const TRAILING_DATE_RE = /\s*(?:\(\s*[\d.\s~]+\)|:\s*[\d.\s~]+)\s*$/;

function decode(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const pad = (n: number) => String(n).padStart(2, "0");
const kstMidnight = (y: number, m: number, d: number) => new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00+09:00`).toISOString();

export function parseKnuSchedule(html: string, year: number): AcademicItem[] {
  const start = html.indexOf('<div id="calendar">');
  if (start < 0) throw new Error("학사일정 표(#calendar)를 찾지 못했습니다. 페이지 구조가 바뀌었을 수 있습니다.");
  const section = html.slice(start);

  const items: AcademicItem[] = [];
  const seen = new Map<string, number>();
  for (const dl of section.matchAll(/<dl>([\s\S]*?)<\/dl>/g)) {
    for (const li of dl[1].matchAll(/<li>\s*<span class="day">\s*(\d{1,2})\.(\d{1,2})[^<]*<\/span>([\s\S]*?)<\/li>/g)) {
      const month = Number(li[1]);
      const day = Number(li[2]);
      const raw = decode(li[3]);
      if (!raw) continue;

      let endAt: string | null = null;
      const r = RANGE_RE.exec(raw);
      if (r) {
        const endMonth = Number(r[5]);
        const endYear = r[4] ? Number(r[4]) : endMonth < month ? year + 1 : year;
        const candidate = kstMidnight(endYear, endMonth, Number(r[6]));
        if (candidate > kstMidnight(year, month, day)) endAt = candidate;
      }

      let title = raw.replace(TRAILING_DATE_RE, "").trim() || raw;
      let targetNote: string | null = null;
      const grad = /^\[대학원\]\s*/.exec(title);
      if (grad) {
        targetNote = "대학원";
        title = `대학원 ${title.slice(grad[0].length)}`;
      }

      const kind = /종료|마감/.test(title) ? "deadline" : HOLIDAY_RE.test(title) ? "other" : "event";
      const date = `${year}-${pad(month)}-${pad(day)}`;
      let key = `knu:${date}:${title}`;
      const dup = seen.get(key) ?? 0;
      seen.set(key, dup + 1);
      if (dup) key += `#${dup + 1}`;

      items.push({
        external_key: key,
        title,
        description: `경북대학교 ${year}학년도 학사일정: ${raw}`,
        kind,
        start_at: kstMidnight(year, month, day),
        end_at: endAt,
        all_day: true,
        target_note: targetNote,
      });
    }
  }
  return items;
}
