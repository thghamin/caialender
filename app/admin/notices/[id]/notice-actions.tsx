"use client";

import { useTransition } from "react";
import { deleteNotice, reanalyzeNotice, setEventStatus } from "@/app/admin/actions";

export function ReanalyzeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("검수 전 초안을 지우고 다시 분석할까요?")) start(() => reanalyzeNotice(id));
      }}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
    >
      다시 분석
    </button>
  );
}

export function DeleteNoticeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("공지를 삭제할까요? 검수 전 초안도 함께 삭제됩니다. 이미 게시된 일정은 남습니다."))
          start(() => deleteNotice(id));
      }}
      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      공지 삭제
    </button>
  );
}

export function PublishAllButton({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        for (const id of ids) await setEventStatus(id, "published");
      })}
      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "게시 중…" : `초안 ${ids.length}개 모두 게시`}
    </button>
  );
}
