"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_BAN_WARNINGS, CHAT_MAX_LENGTH, isBanned, REPORT_REASONS, type ChatMember, type ChatMessage, type ChatRoom } from "@/lib/chat";
import { deleteChatMessage, deleteOwnChatMessage, getChatMessages, reportChatMessage, resetChatWarnings, sendChatMessage, warnChatAuthor } from "../actions";

const POLL_MS = 3000; // 새 메시지 확인 간격
const FULL_SYNC_EVERY = 5; // 이만큼에 한 번은 전체를 다시 받아 삭제된 메시지도 반영
const REASONS = ["욕설·비방", "도배", "광고·홍보", "개인정보 노출", "수업과 무관한 글"];

const timeText = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
const dayText = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });

export function ChatRoomView({ room, initial, member, admin }: { room: ChatRoom; initial: ChatMessage[]; member: ChatMember; admin: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [warnTarget, setWarnTarget] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  // 관리자: 이번 메시지를 공용 '학생회' 이름으로 보낼지 (기본은 내 닉네임)
  const [asStaff, setAsStaff] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  // 인용을 누르면 원래 메시지로 가서 잠깐 표시
  const [flash, setFlash] = useState<number | null>(null);
  const jumpTo = (id: number) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1200);
  };
  const [notice, setNotice] = useState<string>();
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const banned = isBanned(member);

  // 새 메시지 확인 (화면이 보일 때만). 마지막 메시지 번호 뒤의 것만 받는다
  const latestId = useRef<number | undefined>(initial.at(-1)?.id);
  useEffect(() => {
    latestId.current = messages.at(-1)?.id;
  }, [messages]);
  const poll = useRef(0);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    poll.current++;
    if (poll.current % FULL_SYNC_EVERY === 0) {
      setMessages(await getChatMessages(room));
      return;
    }
    const more = await getChatMessages(room, latestId.current);
    if (more.length) setMessages((p) => [...p, ...more.filter((m) => !p.some((x) => x.id === m.id))]);
  }, [room]);
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // 아래쪽을 보고 있었으면 새 메시지가 오면 따라 내려간다
  useEffect(() => {
    const el = list.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const r = await sendChatMessage(room, body, replyTarget?.id, admin && asStaff);
    setSending(false);
    if (r.error || !r.message) return setError(r.error);
    setError(undefined);
    setText("");
    setReplyTarget(null);
    nearBottom.current = true;
    setMessages((p) => (p.some((x) => x.id === r.message!.id) ? p : [...p, r.message!]));
  };

  const markDeleted = (id: number) =>
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, deleted: true, deletedSelf: false, originalBody: m.originalBody ?? m.body, body: "" } : m)));

  return (
    <div className="flex h-[calc(100dvh-230px)] min-h-[420px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-12px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.04] md:h-[calc(100dvh-190px)]">
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex flex-1 flex-col gap-2 overflow-y-auto bg-zinc-50/60 p-3"
        aria-label={`${room}학년 소통방 메시지`}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="m-auto max-w-xs text-center text-sm text-zinc-400">
            <p className="mb-1 text-2xl">💬</p>
            <p>아직 대화가 없어요.</p>
            <p>휴강·시험 범위·과제·진도 소식을 먼저 나눠 보세요!</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.author.id === member.id;
          const newDay = i === 0 || dayText(messages[i - 1].created_at) !== dayText(m.created_at);
          return (
            <div key={m.id} id={`msg-${m.id}`} className={`flex flex-col rounded-xl transition-colors ${flash === m.id ? "bg-amber-100/70" : ""}`}>
              {newDay && <p className="my-2 self-center rounded-full bg-zinc-200/70 px-3 py-0.5 text-xs text-zinc-500">{dayText(m.created_at)}</p>}
              <div className={`flex max-w-[85%] flex-col gap-0.5 ${mine ? "self-end items-end" : "self-start items-start"}`} data-testid="chat-message">
                {m.author.staff ? (
                  <span className="flex items-center gap-1 px-1 text-xs font-bold text-brand">
                    📢 <span className="rounded bg-brand px-1.5 py-px text-[11px] text-white">학생회</span>
                  </span>
                ) : (
                  !mine && <span className="px-1 text-xs font-semibold text-zinc-600">{m.author.nickname}</span>
                )}
                {admin && m.identity && (
                  <span className="px-1 text-[11px] text-zinc-400" data-testid="chat-identity">
                    {m.identity.name} · {m.identity.student_no ?? "학번 없음"} · {m.identity.grade ?? "?"}학년 · 경고 {m.identity.warnings}/{CHAT_BAN_WARNINGS}
                    {m.identity.warnings > 0 && (
                      <button
                        onClick={async () => {
                          if (!confirm(`${m.author.nickname}의 경고를 0으로 초기화할까요? (이용 제한도 풀려요)`)) return;
                          const r = await resetChatWarnings(m.author.id);
                          if (r.error) alert(r.error);
                          else setMessages(await getChatMessages(room));
                        }}
                        className="ml-1 underline"
                      >
                        초기화
                      </button>
                    )}
                  </span>
                )}
                {/* 답장한 원래 메시지 (누르면 그 메시지로) */}
                {m.reply && (
                  <button
                    type="button"
                    onClick={() => jumpTo(m.reply!.id)}
                    className="max-w-full truncate rounded-lg border-l-2 border-brand/60 bg-zinc-100 px-2 py-1 text-left text-[12px] text-zinc-500"
                    data-testid="chat-reply-quote"
                  >
                    ↪ <b className="text-zinc-600">{m.reply.nickname}</b> {m.reply.deleted ? "삭제된 메시지" : m.reply.body}
                  </button>
                )}
                <div className="flex items-end gap-1.5">
                  {mine && <span className="text-[10px] text-zinc-400">{timeText(m.created_at)}</span>}
                  <p
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[14.5px] leading-snug ${
                      m.deleted
                        ? "bg-zinc-100 italic text-zinc-400"
                        : m.author.staff
                          ? "rounded-bl-md bg-brand-soft font-medium text-zinc-900 ring-1 ring-brand/30"
                          : mine
                            ? "rounded-br-md bg-brand text-white"
                            : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-zinc-200"
                    }`}
                  >
                    {m.deleted ? (m.deletedSelf ? "삭제된 메시지예요" : "관리자가 삭제한 메시지예요") : m.body}
                  </p>
                  {!mine && <span className="text-[10px] text-zinc-400">{timeText(m.created_at)}</span>}
                </div>
                {/* 관리자: 지워진 메시지의 원래 내용 (본인이 지운 글도 확인·경고할 수 있다) */}
                {admin && m.deleted && m.originalBody && (
                  <span className="flex max-w-full flex-wrap items-center gap-2 px-1 text-xs text-zinc-400" data-testid="chat-original">
                    <span className="break-all">원래 내용: “{m.originalBody}”</span>
                    {!mine && m.deletedSelf && (
                      <button onClick={() => setWarnTarget({ ...m, body: m.originalBody! })} className="font-semibold text-amber-600 hover:text-amber-700">
                        경고
                      </button>
                    )}
                  </span>
                )}
                {!m.deleted && !banned && (
                  <button
                    onClick={() => {
                      setReplyTarget(m);
                      input.current?.focus();
                    }}
                    className="px-1 text-[11px] text-zinc-400 hover:text-brand"
                  >
                    답장
                  </button>
                )}
                {/* 다른 학생 메시지 신고 → 관리자에게 알림 */}
                {!mine && !admin && !m.deleted && !m.author.staff && (
                  <button onClick={() => setReportTarget(m)} className="px-1 text-[11px] text-zinc-400 hover:text-red-600">
                    신고
                  </button>
                )}
                {/* 본인 메시지 삭제 (관리자는 아래 관리자 삭제를 쓴다) */}
                {mine && !admin && !m.deleted && (
                  <button
                    onClick={async () => {
                      if (!confirm("내 메시지를 삭제할까요?")) return;
                      const r = await deleteOwnChatMessage(m.id);
                      if (r.error) alert(r.error);
                      else setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, deleted: true, deletedSelf: true, body: "" } : x)));
                    }}
                    className="px-1 text-xs text-zinc-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                )}
                {admin && !m.deleted && (
                  <span className="flex gap-2 px-1 text-xs">
                    <button
                      onClick={async () => {
                        if (!confirm("이 메시지를 삭제할까요?")) return;
                        const r = await deleteChatMessage(m.id);
                        if (r.error) alert(r.error);
                        else markDeleted(m.id);
                      }}
                      className="text-zinc-500 hover:text-red-600"
                    >
                      삭제
                    </button>
                    {!mine && !m.author.staff && (
                      <button onClick={() => setWarnTarget(m)} className="font-semibold text-amber-600 hover:text-amber-700">
                        경고
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-zinc-100 p-2">
        {banned ? (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-center text-sm text-red-700">⚠️ 경고 {CHAT_BAN_WARNINGS}회로 소통방에 글을 쓸 수 없어요.</p>
        ) : (
          <>
            {replyTarget && (
              <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-[12.5px]" data-testid="reply-bar">
                <span className="min-w-0 flex-1 truncate text-zinc-600">
                  ↪ <b>{replyTarget.author.id === member.id ? "나" : replyTarget.author.nickname}</b>에게 답장: {replyTarget.body}
                </span>
                <button type="button" onClick={() => setReplyTarget(null)} aria-label="답장 취소" className="shrink-0 text-base leading-none text-zinc-400">
                  ✕
                </button>
              </div>
            )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            {admin && (
              <button
                type="button"
                onClick={() => setAsStaff(!asStaff)}
                aria-pressed={asStaff}
                title="켜면 이번 메시지를 내 닉네임 대신 공용 '학생회' 이름으로 보내요 (공지·제재 안내)"
                className={`h-11 shrink-0 rounded-2xl px-2.5 text-[12px] font-bold leading-tight ${asStaff ? "bg-brand text-white" : "bg-zinc-100 text-zinc-500"}`}
              >
                📢
                <br />
                학생회
              </button>
            )}
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter로 보내고 Shift+Enter는 줄바꿈 (한글 조합 중에는 보내지 않는다)
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={CHAT_MAX_LENGTH}
              placeholder={admin && asStaff ? "학생회 이름으로 보내기 (공지·안내)" : "메시지 보내기"}
              aria-label="메시지"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-300 px-3 py-2.5 text-[16px] outline-none focus:border-brand"
            />
            <button disabled={sending || !text.trim()} className="h-11 shrink-0 rounded-2xl bg-brand px-4 font-bold text-white disabled:opacity-40">
              보내기
            </button>
          </form>
          </>
        )}
        {error && <p className="px-1 pt-1 text-sm text-red-600">{error}</p>}
        {member.warnings > 0 && !banned && (
          <p className="px-1 pt-1 text-xs text-amber-700">⚠️ 받은 경고 {member.warnings}/{CHAT_BAN_WARNINGS} · {CHAT_BAN_WARNINGS}회면 글을 쓸 수 없어요</p>
        )}
      </div>
      {notice && (
        <div role="status" className="animate-pop-in fixed inset-x-4 bottom-28 z-50 mx-auto max-w-sm rounded-2xl bg-zinc-900 px-4 py-3 text-center text-[14px] text-white shadow-xl md:bottom-8">
          {notice}
        </div>
      )}
      {reportTarget && (
        <ReportDialog
          target={reportTarget}
          room={room}
          onClose={() => setReportTarget(null)}
          onDone={() => {
            setReportTarget(null);
            setNotice("신고했어요. 학생회가 확인할게요.");
            setTimeout(() => setNotice(undefined), 2500);
          }}
        />
      )}
      {warnTarget && (
        <WarnDialog
          target={warnTarget}
          onClose={() => setWarnTarget(null)}
          onDone={async () => {
            setWarnTarget(null);
            setMessages(await getChatMessages(room));
          }}
        />
      )}
    </div>
  );
}

function WarnDialog({ target, onClose, onDone }: { target: ChatMessage; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="경고 주기" onClick={(e) => e.stopPropagation()} className="animate-pop-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <p className="text-[17px] font-extrabold">⚠️ {target.author.nickname}에게 경고</p>
        {target.identity && (
          <p className="text-sm text-zinc-500">
            {target.identity.name} · 지금 경고 {target.identity.warnings}/{CHAT_BAN_WARNINGS}
            {target.identity.warnings + 1 >= CHAT_BAN_WARNINGS && <b className="text-red-600"> → 이번 경고로 이용 제한</b>}
          </p>
        )}
        <p className="mt-3 line-clamp-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">“{target.body}”</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full px-3 py-1 text-sm ${reason === r ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              {r}
            </button>
          ))}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          aria-label="경고 사유"
          className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base outline-none focus:border-amber-500"
        />
        <p className="mt-2 text-xs text-zinc-500">경고하면 이 메시지는 삭제되고, 학생에게 경고 횟수와 사유가 알림으로 가요.</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-semibold text-zinc-600 ring-1 ring-zinc-200">
            취소
          </button>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await warnChatAuthor(target.id, reason);
              setPending(false);
              if (r.error) setError(r.error);
              else onDone();
            }}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {pending ? "처리 중" : "경고하고 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 학생: 신고 사유 고르기 → 관리자에게 알림 */
function ReportDialog({ target, room, onClose, onDone }: { target: ChatMessage; room: ChatRoom; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="메시지 신고" onClick={(e) => e.stopPropagation()} className="animate-pop-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <p className="text-[17px] font-extrabold">🚨 메시지 신고</p>
        <p className="mt-0.5 text-[13px] text-zinc-500">학생회(관리자)에게 알림이 가요. 신고한 사람은 상대에게 알려지지 않아요.</p>
        <p className="mt-3 line-clamp-3 rounded-xl bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700">
          <b>{target.author.nickname}</b>: {target.body}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full px-3 py-1 text-[13px] ${reason === r ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              {r}
            </button>
          ))}
        </div>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={150}
          placeholder="자세한 내용 (선택)"
          aria-label="신고 내용"
          className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-[16px] outline-none focus:border-red-500"
        />
        {error && <p className="mt-1 text-[13px] text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-[14px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
            취소
          </button>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await reportChatMessage(target.id, room, detail.trim() ? `${reason} — ${detail.trim()}` : reason);
              setPending(false);
              if (r.error) setError(r.error);
              else onDone();
            }}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "보내는 중" : "신고하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
