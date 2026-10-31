"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_BAN_WARNINGS } from "@/lib/chat";
import { formatKst } from "@/lib/datetime";
import { handleChatReport, type ChatReport } from "../actions";

const STATUS: Record<ChatReport["status"], string> = { open: "처리 대기", resolved: "조치함", dismissed: "문제없음" };

/** 관리자: 신고 목록. 같은 메시지 신고는 한 카드로 묶고, 경고+삭제 / 삭제만 / 문제없음으로 처리 */
export function ReportList({ reports }: { reports: ChatReport[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  // 메시지별로 묶기 (최근 신고 순)
  const groups = new Map<number, ChatReport[]>();
  for (const r of reports) groups.set(r.message_id, [...(groups.get(r.message_id) ?? []), r]);

  if (!groups.size) return <p className="rounded-2xl bg-white p-6 text-center text-[13px] text-zinc-500">처리할 신고가 없어요. 👍</p>;

  const act = async (r: ChatReport, action: "warn" | "delete" | "dismiss") => {
    const reason = action === "warn" ? r.reason.split(" — ")[0] : "";
    const label = action === "warn" ? `경고(${reason})하고 메시지를 삭제할까요?` : action === "delete" ? "메시지만 삭제할까요?" : "문제없음으로 처리할까요?";
    if (!confirm(label)) return;
    setBusy(r.message_id);
    const res = await handleChatReport(r.message_id, action, reason);
    setBusy(null);
    if (res.error) alert(res.error);
    else router.refresh();
  };

  return (
    <ul className="flex flex-col gap-2">
      {[...groups.values()].map((list) => {
        const r = list[0];
        const open = list.some((x) => x.status === "open");
        return (
          <li key={r.message_id} className={`rounded-2xl bg-white p-3.5 ring-1 ${open ? "ring-red-200" : "ring-black/[0.05]"}`} data-testid="chat-report">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className={`rounded-full px-2 py-0.5 font-bold ${open ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-500"}`}>{STATUS[r.status]}</span>
              <span className="text-zinc-500">
                {r.room}학년 방 · 신고 {r.report_count}건 · {formatKst(r.created_at)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-zinc-50 px-3 py-2 text-[14px] text-zinc-800">
              {r.body}
              {r.message_deleted && <span className="ml-1 text-[11px] text-zinc-400">(삭제됨)</span>}
            </p>
            <p className="mt-1.5 text-[12.5px] text-zinc-600">
              작성: <b>{r.author_nickname}</b> ({r.author_name}) · 경고 {r.author_warnings}/{CHAT_BAN_WARNINGS} · {formatKst(r.message_at)}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-zinc-500">
              {list.map((x) => (
                <li key={x.id}>
                  🚨 {x.reason} <span className="text-zinc-400">— 신고: {x.reporter_nickname} ({x.reporter_name})</span>
                </li>
              ))}
            </ul>
            {open && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px]">
                <button disabled={busy === r.message_id} onClick={() => act(r, "warn")} className="rounded-full bg-amber-500 px-3 py-1 font-semibold text-white disabled:opacity-50">
                  경고하고 삭제
                </button>
                {!r.message_deleted && (
                  <button disabled={busy === r.message_id} onClick={() => act(r, "delete")} className="rounded-full bg-zinc-800 px-3 py-1 font-semibold text-white disabled:opacity-50">
                    삭제만
                  </button>
                )}
                <button disabled={busy === r.message_id} onClick={() => act(r, "dismiss")} className="rounded-full px-3 py-1 font-semibold text-zinc-600 ring-1 ring-zinc-300 disabled:opacity-50">
                  문제없음
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
