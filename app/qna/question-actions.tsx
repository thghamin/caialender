"use client";

import { useActionState, useState, useTransition } from "react";
import { answerQuestion, deleteQuestion } from "./actions";
import { Alert, Button } from "@/components/ui";

export function AnswerForm({ id, current }: { id: string; current: string | null }) {
  const [state, action, pending] = useActionState(answerQuestion, undefined);
  const [open, setOpen] = useState(!current);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-zinc-500 hover:text-brand">
        답변 수정
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="answer"
        required
        maxLength={2000}
        rows={3}
        defaultValue={current ?? ""}
        placeholder="학생회 답변을 입력하세요"
        aria-label="답변"
        className="rounded-lg border border-brand/30 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="flex items-center gap-2">
        <Button disabled={pending}>{pending ? "저장 중…" : current ? "답변 수정" : "답변 등록"}</Button>
        {current && (
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500">
            취소
          </button>
        )}
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </form>
  );
}

export function DeleteQuestionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!confirm("질문을 삭제할까요?")) return;
            setError((await deleteQuestion(id)).error);
          })
        }
        className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50"
      >
        삭제
      </button>
    </span>
  );
}
