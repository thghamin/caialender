"use client";

import { useState, useTransition } from "react";
import { renameNotice } from "@/app/admin/actions";

/** 공지 제목: AI가 지은 제목을 보여주고, 눌러서 바로 고친다 */
export function NoticeTitle({ id, title, auto }: { id: string; title: string; auto: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{title}</h1>
        {auto && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">🤖 AI가 지은 제목</span>}
        <button onClick={() => setEditing(true)} className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100">
          ✏️ 제목 고치기
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await renameNotice(id, value);
          if (r.error) setError(r.error);
          else setEditing(false);
        });
      }}
    >
      <input
        aria-label="공지 제목"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        autoFocus
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-lg font-bold outline-none focus:border-brand"
      />
      <button disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "저장 중" : "저장"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-zinc-500">
        취소
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
