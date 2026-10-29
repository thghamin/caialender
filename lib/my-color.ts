// 사용자 지정 색: 무지개 7색 중 고른다. 학과 캘린더(초록)·학사 캘린더(KNU 빨강)를 뺀 사이트 전체의 기본 색이 된다.
// 쿠키에 저장해서 서버가 처음부터 그 색으로 그린다(깜빡임 없음).
// brand는 흰 글자를 올려도 잘 보이는 진한 색(대비 4.5:1 이상), main은 배너 그라데이션 시작 색.
export const MY_COLOR_COOKIE = "my_color";

export const MY_COLORS = {
  red: { label: "빨강", main: "#da2128", brand: "#c41b22" },
  orange: { label: "주황", main: "#ea580c", brand: "#c2410c" },
  yellow: { label: "노랑", main: "#ca8a04", brand: "#a16207" },
  green: { label: "초록", main: "#16a34a", brand: "#15803d" },
  blue: { label: "파랑", main: "#2563eb", brand: "#1d4ed8" },
  indigo: { label: "남색", main: "#4f46e5", brand: "#4338ca" },
  violet: { label: "보라", main: "#9333ea", brand: "#7e22ce" },
} as const;

export type MyColor = keyof typeof MY_COLORS;

export const isMyColor = (v: string | undefined): v is MyColor => !!v && v in MY_COLORS;

/** <html>에 거는 CSS 변수. globals.css의 --brand가 이것을 쓴다 */
export function userColorVars(color: MyColor) {
  const c = MY_COLORS[color];
  return { "--user-main": c.main, "--user-brand": c.brand } as Record<string, string>;
}
