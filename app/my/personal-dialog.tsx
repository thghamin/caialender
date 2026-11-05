"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PersonalEventForm } from "./personal-form";

/** 내 캘린더 위쪽 '+ 개인 일정 추가' 버튼. 누르면 제목·날짜·시간을 고르는 창이 뜨고, 추가하면 닫힌다 */
export function PersonalEventButton({ nowIso }: { nowIso: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    setDone(true);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // 창이 떠 있는 동안 뒤 화면이 스크롤되지 않게
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-[13.5px] font-bold text-white shadow-md shadow-black/15 hover:bg-zinc-800"
      >
        + 개인 일정 추가
      </button>
      {done && (
        <p role="status" className="animate-pop-in fixed inset-x-4 bottom-28 z-50 mx-auto max-w-sm rounded-2xl bg-zinc-900 px-4 py-3 text-center text-[14px] text-white shadow-xl md:bottom-8">
          개인 일정을 추가했어요 ✓
        </p>
      )}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={close}>
            <div
              role="dialog"
              aria-label="개인 일정 추가"
              onClick={(e) => e.stopPropagation()}
              className="animate-pop-in flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
                <p className="text-[17px] font-extrabold">➕ 개인 일정 추가</p>
                <button type="button" onClick={close} aria-label="닫기" className="text-2xl leading-none text-zinc-400">
                  ×
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
                <PersonalEventForm nowIso={nowIso} onSaved={saved} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
