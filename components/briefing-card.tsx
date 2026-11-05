"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; title: string; when: string; location: string | null; kind: "event" | "deadline" | "other"; ongoing: boolean };
type State = { status: "loading" } | { status: "ok"; summary: string; items: Item[] } | { status: "error"; message: string };

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
        else setState({ status: "ok", summary: json.summary, items: json.items ?? [] });
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
          <p className="text-[13.5px] leading-[1.7] text-zinc-800 sm:text-sm sm:leading-6">{state.summary}</p>
          {/* 일정 목록: 날짜·시각은 코드가 정확히 만든 값. 일정마다 칸을 나눠 어디까지가 한 일정인지 바로 보이게 */}
          {state.items.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2" data-testid="briefing-items">
              {state.items.map((i) => (
                <li key={i.id}>
                  <Link href={`/events/${i.id}`} className="block rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-black/[0.05] transition-colors hover:bg-white">
                    <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold tabular-nums text-zinc-900">
                      {i.kind === "deadline" && <span className="rounded bg-rose-100 px-1.5 py-px text-[11px] font-bold text-rose-700">마감</span>}
                      {i.ongoing && <span className="rounded bg-brand-soft px-1.5 py-px text-[11px] font-bold text-brand">진행 중</span>}
                      {i.when}
                    </p>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-zinc-700">
                      {i.title}
                      {i.location && <span className="text-zinc-500"> · {i.location}</span>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[0.6875rem] text-zinc-400">🤖 학생회가 게시한 일정만으로 AI가 정리했어요 · 날짜·시각은 캘린더 기준</p>
        </>
      )}
    </div>
  );
}
