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
      className="rounded-2xl border p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--brand) 30%, transparent)",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 8%, white), white)",
      }}
    >
      <h2 className="font-semibold mb-2">✨ AI 주간 브리핑</h2>
      {state.status === "loading" && <p className="text-sm text-zinc-500 animate-pulse">이번 주 일정을 정리하고 있어요…</p>}
      {state.status === "error" && <p className="text-sm text-zinc-500">{state.message}</p>}
      {state.status === "ok" && (
        <>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{state.content}</p>
          <p className="mt-2 text-[11px] text-zinc-400">AI가 게시된 일정만으로 작성했어요{state.model ? ` · ${state.model}` : ""}</p>
        </>
      )}
    </div>
  );
}
