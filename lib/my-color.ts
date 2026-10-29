// 내 캘린더 색: 무지개 7색 중 사용자가 고른다. 쿠키에 저장해서 서버가 처음부터 그 색으로 그린다(깜빡임 없음).
export const MY_COLOR_COOKIE = "my_color";

export const MY_COLORS = {
  red: { label: "빨강", main: "#da2128", dark: "#a8141b" },
  orange: { label: "주황", main: "#f97316", dark: "#c2410c" },
  yellow: { label: "노랑", main: "#eab308", dark: "#a16207" },
  green: { label: "초록", main: "#22c55e", dark: "#15803d" },
  blue: { label: "파랑", main: "#3b82f6", dark: "#1d4ed8" },
  indigo: { label: "남색", main: "#4f46e5", dark: "#312e81" },
  violet: { label: "보라", main: "#a855f7", dark: "#7e22ce" },
} as const;

export type MyColor = keyof typeof MY_COLORS;

export const isMyColor = (v: string | undefined): v is MyColor => !!v && v in MY_COLORS;

/** 내 캘린더 영역에 적용할 CSS 변수 */
export function myColorVars(color: MyColor) {
  const c = MY_COLORS[color];
  return { "--my-main": c.main, "--my-dark": c.dark, "--cal-accent": c.dark } as Record<string, string>;
}
