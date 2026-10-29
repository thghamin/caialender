"use client";

import { useState } from "react";
import { MY_COLOR_COOKIE, MY_COLORS, myColorVars, type MyColor } from "@/lib/my-color";

/** 화면(CSS 변수)과 쿠키에 색을 적용한다. 서버 왕복이 없어 즉시 바뀐다 */
function applyColor(targetId: string, c: MyColor) {
  const el = document.getElementById(targetId);
  for (const [k, v] of Object.entries(myColorVars(c))) el?.style.setProperty(k, v);
  document.cookie = `${MY_COLOR_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
}

/** 무지개 색 고르기. 서버를 거치지 않고 CSS 변수만 바꿔서 즉시 반영하고, 쿠키에 저장한다 */
export function MyColorPicker({ initial, targetId }: { initial: MyColor; targetId: string }) {
  const [color, setColor] = useState(initial);

  const choose = (c: MyColor) => {
    setColor(c);
    applyColor(targetId, c);
  };

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 ring-1 ring-white/30" role="group" aria-label="내 캘린더 색">
      <span className="mr-1 text-xs font-semibold">🎨 색</span>
      {(Object.keys(MY_COLORS) as MyColor[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => choose(c)}
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
