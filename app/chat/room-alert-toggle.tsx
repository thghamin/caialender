"use client";

import { useState } from "react";
import { ensurePushSubscription, pushHint } from "@/lib/client/push";
import { setRoomAlert } from "./actions";

/** 방 알림 켜기·끄기 (기본 꺼짐). 켤 때 이 기기도 알림 받을 기기로 등록한다 */
export function RoomAlertToggle({ room, initialOn, compact = false }: { room: number; initialOn: boolean; compact?: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const toggle = async () => {
    setPending(true);
    const next = !on;
    const r = await setRoomAlert(room, next);
    if (r.error) {
      setPending(false);
      return setHint(r.error);
    }
    setOn(next);
    setHint(next ? pushHint(await ensurePushSubscription()) : null);
    setPending(false);
  };
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        aria-label={`${room}학년 소통방 알림 ${on ? "끄기" : "켜기"}`}
        title={on ? "알림 켜짐 (누르면 끄기)" : "알림 꺼짐 (누르면 켜기)"}
        className={`inline-flex items-center gap-1 rounded-full font-semibold transition-colors disabled:opacity-50 ${
          compact ? "px-2 py-1 text-[12px]" : "px-2.5 py-1.5 text-[12px]"
        } ${on ? "bg-brand text-white" : "bg-zinc-100 text-zinc-500"}`}
      >
        <span aria-hidden>{on ? "🔔" : "🔕"}</span>
        {on ? "알림 켬" : "알림 끔"}
      </button>
      {hint && (
        <span role="status" className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl bg-zinc-900 px-3 py-2 text-[12px] leading-snug text-white shadow-lg" onClick={() => setHint(null)}>
          {hint}
        </span>
      )}
    </span>
  );
}
