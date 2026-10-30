"use client";

import { useState, useTransition } from "react";
import { toggleReminder } from "@/app/notifications/actions";

/** 목록용 작은 알림 버튼: 하루 전 / 1시간 전 */
export function ReminderBell({ type, id, lead, initial }: { type: "event" | "personal"; id: string; lead: 60 | 1440; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${lead === 1440 ? "하루 전" : "1시간 전"} 알림 ${on ? "끄기" : "켜기"}`}
      title={`${lead === 1440 ? "하루 전" : "1시간 전"} 알림 ${on ? "켜짐" : "꺼짐"}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!(await toggleReminder(type, id, !on, lead)).error) setOn(!on);
        })
      }
      className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[0.6875rem] font-semibold disabled:opacity-50 ${
        on ? "border-brand bg-brand text-white" : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
      }`}
    >
      🔔 {lead === 1440 ? "하루" : "1시간"}
    </button>
  );
}
