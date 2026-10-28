"use client";

import { useTransition } from "react";
import { toggleInterest } from "@/app/my/actions";

export function InterestButton({ eventId, active }: { eventId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => toggleInterest(eventId, !active))}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
        active ? "border border-zinc-300 bg-white hover:bg-zinc-100" : "bg-brand text-white hover:opacity-90"
      }`}
    >
      {pending ? "처리 중…" : active ? "★ 내 캘린더에서 빼기" : "☆ 내 캘린더에 추가"}
    </button>
  );
}
