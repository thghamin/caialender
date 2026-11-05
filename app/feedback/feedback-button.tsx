"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sendFeedback } from "./actions";

/** 맨 아래 '의견 남기기': 누르면 바로 의견을 쓰는 창이 뜬다. 보낸 의견은 학생회(관리자)만 본다 */
export function FeedbackButton({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  // 로그인 전에는 로그인 화면으로 (의견은 회원만 보낼 수 있다)
  if (!loggedIn)
    return (
      <Link href="/login" prefetch={false} className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
        의견 남기기
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
        의견 남기기
      </button>
      {open && createPortal(<FeedbackDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const page = usePathname();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // 휴대폰: 화면 위쪽에 바로 보이게 (아래쪽에 두면 키보드에 가려 스크롤해야 보인다)
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-[max(4.5rem,calc(env(safe-area-inset-top)+1rem))] sm:items-center sm:pt-3" onClick={onClose}>
      <div role="dialog" aria-label="의견 남기기" onClick={(e) => e.stopPropagation()} className="animate-pop-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-3xl">💌</p>
            <p className="text-[17px] font-extrabold">의견을 보냈어요. 고마워요!</p>
            <p className="text-[13.5px] leading-relaxed text-zinc-500">학생회가 확인하고 서비스를 고쳐 나갈게요.</p>
            <button type="button" onClick={onClose} className="mt-3 w-full rounded-2xl bg-brand py-3 text-[15px] font-bold text-white">
              닫기
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await sendFeedback({ body, page });
                if (r.error) setError(r.error);
                else setDone(true);
              });
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-extrabold">💬 의견 남기기</p>
              <button type="button" onClick={onClose} aria-label="닫기" className="text-xl leading-none text-zinc-400">
                ×
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-500">
              불편한 점, 안 되는 기능, 있으면 좋겠는 기능을 편하게 적어 주세요.
              <b className="mt-0.5 block font-bold text-zinc-700">🔒 학생회(관리자)만 볼 수 있어요.</b>
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={2}
              maxLength={1000}
              rows={5}
              // PC만 바로 입력 (휴대폰은 키보드가 바로 올라오면 화면이 밀린다)
              autoFocus={typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches}
              aria-label="의견"
              placeholder="예: 시간표 가져오기에서 토요일 수업이 안 보여요"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 md:text-sm"
            />
            {error && <p className="text-[13px] text-red-600">{error}</p>}
            <button disabled={pending || body.trim().length < 2} className="rounded-2xl bg-brand py-3 text-[15px] font-bold text-white disabled:opacity-40">
              {pending ? "보내는 중…" : "보내기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
