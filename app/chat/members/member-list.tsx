"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_BAN_WARNINGS } from "@/lib/chat";
import { formatKst } from "@/lib/datetime";
import { resetChatWarnings, warnChatMember, type ChatAdminMember } from "../actions";

/** 관리자: 소통방 멤버 목록 — 닉네임 · 실제 회원 · 활동 · 경고/닉네임 기록, 경고·이용 제한·해제 */
export function MemberList({ members }: { members: ChatAdminMember[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [action, setAction] = useState<{ member: ChatAdminMember; ban: boolean } | null>(null);
  const q = query.trim().toLowerCase();
  const shown = q
    ? members.filter((m) =>
        [m.nickname, m.name, m.student_no ?? "", ...m.nicknames.map((n) => n.old_nickname)].some((v) => v.toLowerCase().includes(q)),
      )
    : members;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="닉네임·이름·학번 검색"
          aria-label="멤버 검색"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[16px] outline-none focus:border-brand"
        />
        <span className="text-[12px] text-zinc-500">
          멤버 {shown.length}명 · 이용 제한 {members.filter((m) => m.warnings >= CHAT_BAN_WARNINGS).length}명
        </span>
      </div>
      {shown.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-[13px] text-zinc-500">아직 소통방 멤버가 없어요.</p>}
      <ul className="flex flex-col gap-2">
        {shown.map((m) => {
          const banned = m.warnings >= CHAT_BAN_WARNINGS;
          const expanded = open === m.id;
          return (
            <li key={m.id} className={`rounded-2xl bg-white p-3.5 ring-1 ${banned ? "ring-red-200" : "ring-black/[0.05]"}`} data-testid="chat-member">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[15px] font-bold">{m.nickname}</span>
                {m.staff && <span className="rounded bg-brand px-1 py-px text-[10px] font-bold text-white">학생회</span>}
                {banned ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700" data-testid="ban-badge">
                    이용 제한 중
                  </span>
                ) : m.warnings > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    경고 {m.warnings}/{CHAT_BAN_WARNINGS}
                  </span>
                ) : null}
                <span className="w-full text-[13px] text-zinc-600 sm:w-auto">
                  {m.name} · {m.student_no ?? "학번 없음"} · {m.grade ?? "?"}학년
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-zinc-500">
                메시지 {m.message_count}개 · 마지막 활동 {m.last_message_at ? formatKst(m.last_message_at) : "없음"}
                {m.nicknames.length > 0 && ` · 닉네임 ${m.nicknames.length}번 바꿈`}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px]">
                <button onClick={() => setOpen(expanded ? null : m.id)} className="rounded-full px-3 py-1 text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50">
                  {expanded ? "기록 닫기" : "기록 보기"}
                </button>
                {!banned && (
                  <>
                    <button onClick={() => setAction({ member: m, ban: false })} className="rounded-full bg-amber-500 px-3 py-1 font-semibold text-white">
                      경고
                    </button>
                    <button onClick={() => setAction({ member: m, ban: true })} className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white">
                      이용 제한
                    </button>
                  </>
                )}
                {m.warnings > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`${m.nickname}의 경고를 0으로 초기화할까요?${banned ? " (이용 제한도 풀려요)" : ""}`)) return;
                      const r = await resetChatWarnings(m.id);
                      if (r.error) alert(r.error);
                      else router.refresh();
                    }}
                    className="rounded-full px-3 py-1 font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
                  >
                    {banned ? "제한 풀기" : "경고 초기화"}
                  </button>
                )}
              </div>
              {expanded && (
                <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-zinc-500">경고 기록</p>
                    {m.history.length ? (
                      <ul className="flex flex-col gap-1">
                        {m.history.map((h, i) => (
                          <li key={i} className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                            {h.reason} <span className="text-[11px] text-zinc-400">· {formatKst(h.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">없음</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-zinc-500">닉네임 변경 기록</p>
                    {m.nicknames.length ? (
                      <ul className="flex flex-col gap-1" data-testid="nickname-history">
                        {m.nicknames.map((n, i) => (
                          <li key={i} className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                            {n.old_nickname} → <b>{n.new_nickname}</b> <span className="text-[11px] text-zinc-400">· {formatKst(n.changed_at)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">없음</p>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {action && <ActionDialog {...action} onClose={() => setAction(null)} onDone={() => (setAction(null), router.refresh())} />}
    </div>
  );
}

function ActionDialog({ member, ban, onClose, onDone }: { member: ChatAdminMember; ban: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(ban ? "운영 정책 위반" : "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={ban ? "이용 제한" : "멤버 경고"} onClick={(e) => e.stopPropagation()} className="animate-pop-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <p className="text-[17px] font-extrabold">{ban ? "🚫 이용 제한" : "⚠️ 경고"} — {member.nickname}</p>
        <p className="text-[13px] text-zinc-500">
          {member.name} · 지금 경고 {member.warnings}/{CHAT_BAN_WARNINGS}
          {(ban || member.warnings + 1 >= CHAT_BAN_WARNINGS) && <b className="text-red-600"> → 소통방에 더 이상 들어올 수 없어요</b>}
        </p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="사유 (학생에게 알림으로 가요)"
          aria-label="사유"
          className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-[16px] outline-none focus:border-amber-500"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-semibold text-zinc-600 ring-1 ring-zinc-200">
            취소
          </button>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await warnChatMember(member.id, reason, ban);
              setPending(false);
              if (r.error) setError(r.error);
              else onDone();
            }}
            className={`flex-1 rounded-xl py-2.5 font-bold text-white disabled:opacity-50 ${ban ? "bg-red-600" : "bg-amber-500"}`}
          >
            {pending ? "처리 중" : ban ? "이용 제한하기" : "경고하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
