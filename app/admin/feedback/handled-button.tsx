"use client";

import { useTransition } from "react";
import { setFeedbackHandled } from "@/app/feedback/actions";

export function HandledButton({ id, handled }: { id: string; handled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setFeedbackHandled(id, !handled)))}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${handled ? "border border-zinc-300 bg-white text-zinc-600" : "bg-brand text-white"}`}
    >
      {pending ? "처리 중…" : handled ? "새 의견으로 되돌리기" : "✓ 확인함"}
    </button>
  );
}
