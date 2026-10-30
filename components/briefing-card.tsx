"use client";

import { useEffect, useState } from "react";

type State = { status: "loading" } | { status: "ok"; content: string; model: string | null } | { status: "error"; message: string };

/** AI 주간 브리핑. 캘린더와 독립적으로 불러와서 AI 장애가 캘린더 조회에 영향을 주지 않는다 */
export function BriefingCard({ scope }: { scope: "all" | "me" }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    fetch(`/api/briefing?scope=${scope}`)
      .then(async (res) => {
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) setState({ status: "error", message: json.error ?? "브리핑을 불러오지 못했어요." });
        else setState({ status: "ok", content: json.content, model: json.model });
      })
      .catch(() => alive && setState({ status: "error", message: "브리핑을 불러오지 못했어요." }));
    return () => {
      alive = false;
    };
  }, [scope]);

  return (
    <div
      data-testid="briefing-card"
      className="relative overflow-hidden rounded-[22px] p-5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.15)] ring-1 ring-black/[0.04]"
      style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--brand) 13%, white), white 70%)" }}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-xl bg-brand text-base text-white shadow-sm" aria-hidden>
          ✨
        </span>
        <h2 className="text-[1.05rem] font-bold">AI 주간 브리핑</h2>
      </div>
      {state.status === "loading" && <p className="text-sm text-zinc-500 animate-pulse">이번 주 일정을 정리하고 있어요…</p>}
      {state.status === "error" && <p className="text-sm text-zinc-500">{state.message}</p>}
      {state.status === "ok" && (
        <>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{state.content}</p>
          <p className="mt-2 text-[0.6875rem] text-zinc-400">AI가 게시된 일정만으로 작성했어요{state.model ? ` · ${state.model}` : ""}</p>
        </>
      )}
    </div>
  );
}
