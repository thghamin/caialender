"use client";

import { useState, useTransition } from "react";
import { toggleReminder } from "@/app/notifications/actions";

/** 목록용 작은 알림 버튼 (🔔 켜짐 / 🔕 꺼짐) */
export function ReminderBell({ type, id, initial }: { type: "event" | "personal"; id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "하루 전 알림 끄기" : "하루 전 알림 켜기"}
      title={on ? "하루 전 알림 켜짐" : "하루 전 알림 꺼짐"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!(await toggleReminder(type, id, !on)).error) setOn(!on);
        })
      }
      className={`rounded-full px-1.5 text-base disabled:opacity-50 ${on ? "" : "opacity-40 grayscale hover:opacity-80"}`}
    >
      {on ? "🔔" : "🔕"}
    </button>
  );
}
