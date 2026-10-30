"use client";

import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";

function switchTo(mode: ViewMode) {
  document.cookie = `${VIEW_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  // viewport(화면 폭) 설정이 바뀌므로 새로 불러온다
  window.location.reload();
}

/** 휴대폰에서 PC 버전 ↔ 모바일 버전 전환. PC 모드는 휴대폰에서만 켤 수 있어서, PC에서는 버튼이 보이지 않는다 */
export function ViewModeToggle({ mode }: { mode: ViewMode }) {
  if (mode === "pc") {
    return (
      <button
        onClick={() => switchTo("mobile")}
        className="rounded-full border border-brand/30 bg-white px-6 py-3 text-2xl font-semibold text-brand shadow-sm"
      >
        📱 모바일 버전으로 보기
      </button>
    );
  }
  return (
    <button onClick={() => switchTo("pc")} className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs text-zinc-600 md:hidden">
      🖥️ PC 버전으로 보기
    </button>
  );
}
