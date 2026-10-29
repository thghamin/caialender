"use client";

import { useState } from "react";
import { MY_COLOR_COOKIE, MY_COLORS, userColorVars, type MyColor } from "@/lib/my-color";

/** 사이트 전체(<html>)의 CSS 변수와 쿠키에 색을 적용한다. 서버 왕복이 없어 즉시 바뀐다 */
function applyColor(c: MyColor) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(userColorVars(c))) root.style.setProperty(k, v);
  document.cookie = `${MY_COLOR_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
}

/** 무지개 색 고르기. 학과(초록)·학사(빨강) 캘린더를 뺀 사이트 전체 색이 바뀐다 */
export function MyColorPicker({ initial }: { initial: MyColor }) {
  const [color, setColor] = useState(initial);

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 ring-1 ring-white/30" role="group" aria-label="내 테마 색">
      <span className="mr-1 text-xs font-semibold">🎨 내 색</span>
      {(Object.keys(MY_COLORS) as MyColor[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            setColor(c);
            applyColor(c);
          }}
          aria-label={MY_COLORS[c].label}
          aria-pressed={c === color}
          title={MY_COLORS[c].label}
          className={`size-6 rounded-full border-2 transition-transform hover:scale-110 ${c === color ? "scale-110 border-white shadow-md" : "border-white/50"}`}
          style={{ background: MY_COLORS[c].main }}
        />
      ))}
    </div>
  );
}
