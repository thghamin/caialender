"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = ["신청은 어떻게 해요?", "준비물이 있나요?", "마감이 언제예요?"];

export function NoticeChat({ noticeId, enabled }: { noticeId: string; enabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const update = (content: string, error = false) =>
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content, error }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noticeId, messages: history.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: "요청에 실패했어요." }));
        update(error, true);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        // 서버가 \u0000으로 시작하는 메시지를 보내면 AI 장애 안내
        if (answer.startsWith("\u0000")) update(answer.slice(1), true);
        else update(answer);
        bottomRef.current?.scrollIntoView({ block: "nearest" });
      }
    } catch {
      update("네트워크 문제로 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-zinc-200 bg-white lg:sticky lg:top-4">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="font-semibold">🤖 이 공지에 대해 물어보기</p>
        <p className="text-xs text-zinc-500">AI는 이 공지 내용만 근거로 답해요. 중요한 내용은 원문을 꼭 확인하세요.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {!enabled && <p className="text-sm text-red-600">AI 서비스가 설정되지 않았습니다.</p>}
        {messages.length === 0 && enabled && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-brand text-white"
                : m.error
                  ? "self-start bg-red-50 text-red-700"
                  : "self-start bg-zinc-100 text-zinc-800"
            }`}
          >
            {m.content || (busy && i === messages.length - 1 ? "답변 작성 중…" : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-zinc-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!enabled}
          maxLength={500}
          placeholder="예: 참가비는 얼마예요?"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button disabled={busy || !enabled || !input.trim()} className="rounded-md bg-brand px-4 text-sm font-medium text-white disabled:opacity-50">
          전송
        </button>
      </form>
    </div>
  );
}
