// 달력 칸(휴대폰)에 보일 짧은 제목: 앞에 붙은 연도·학기·회차를 떼고 핵심 단어부터 보이게
// 예: "26-2학기 MT" → "MT", "2026학년도 2학기 대학원 전공체험 박람회" → "대학원 전공체험 박람회"
// 전체 제목은 일정을 누르면 팝업·상세에서 그대로 보인다.
const PREFIX = /^(?:\d{2,4}\s*학년도|\d{4}\s*년|\d{4}(?=\s)|\d{2}-\d\s*학기|\d\s*학기|제\s*\d+\s*회)\s*/;

export function shortTitle(title: string) {
  let s = title.trim();
  let prev;
  do {
    prev = s;
    s = s.replace(PREFIX, "");
  } while (s !== prev);
  return s || title;
}
