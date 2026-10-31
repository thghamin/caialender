"use client";

import { useActionState, useEffect, useRef } from "react";
import { askQuestion } from "./actions";
import { Alert, Button } from "@/components/ui";

export function AskForm({ eventId, eventTitle }: { eventId?: string; eventTitle?: string }) {
  const [state, action, pending] = useActionState(askQuestion, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.savedAt) ref.current?.reset();
  }, [state?.savedAt]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="event_id" value={eventId ?? ""} />
      {eventTitle && <p className="text-xs text-zinc-500">📅 「{eventTitle}」 일정에 대한 질문</p>}
      <textarea
        name="body"
        required
        maxLength={1000}
        rows={3}
        placeholder="예: 개강총회 회비는 얼마인가요? 신청은 어디서 하나요?"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[16px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 md:text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-zinc-400">학생회가 확인하고 직접 답변해요. 다른 학생에게 내 이름은 보이지 않아요.</p>
        <Button disabled={pending} className="shrink-0 whitespace-nowrap">{pending ? "보내는 중…" : "질문 남기기"}</Button>
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.savedAt && !state.error && <p className="text-sm text-emerald-700">질문을 남겼어요. 답변이 달리면 여기에서 볼 수 있어요.</p>}
    </form>
  );
}
