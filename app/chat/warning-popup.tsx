"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAT_BAN_WARNINGS } from "@/lib/chat";
import { ackWarnings, getUnseenWarnings } from "./actions";

type Unseen = Awaited<ReturnType<typeof getUnseenWarnings>>;
const SEEN_KEY = "caialender_chat_warn_seen";

/**
 * 아직 확인하지 않은 소통방 경고가 있으면 화면 가운데 팝업으로 알린다. [확인]을 누르면 다시 뜨지 않는다.
 * pollMs를 주면 그 간격으로 다시 확인한다 (방 안에 있는 동안 받은 경고도 바로 보이게).
 */
export function WarningPopup({ pollMs }: { pollMs?: number }) {
  const [data, setData] = useState<Unseen | null>(null);
  const check = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const r = await getUnseenWarnings();
    // 이 기기에서 방금 확인한 경고는 계정 기록이 저장되기 전이라도 다시 띄우지 않는다
    const local = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    const items = r.items.filter((w) => w.id > local);
    setData(items.length ? { ...r, items } : null);
  }, []);
  useEffect(() => {
    const first = setTimeout(check, 400);
    const t = pollMs ? setInterval(check, pollMs) : undefined;
    return () => {
      clearTimeout(first);
      if (t) clearInterval(t);
    };
  }, [check, pollMs]);

  if (!data) return null;
  const banned = data.total >= CHAT_BAN_WARNINGS;
  const close = async () => {
    const last = Math.max(...data.items.map((w) => w.id));
    localStorage.setItem(SEEN_KEY, String(Math.max(last, Number(localStorage.getItem(SEEN_KEY) ?? 0))));
    setData(null);
    await ackWarnings(last);
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-5">
      <div role="alertdialog" aria-label="소통방 경고" className="animate-pop-in w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
        <span className={`mx-auto grid size-14 place-items-center rounded-full text-3xl ${banned ? "bg-red-50" : "bg-amber-50"}`} aria-hidden>
          {banned ? "🚫" : "⚠️"}
        </span>
        <p className="mt-3 text-[17px] font-extrabold">학생회로부터 경고를 받았어요</p>
        <p className={`mt-1 text-[15px] font-bold ${banned ? "text-red-600" : "text-amber-600"}`}>
          경고 {Math.min(data.total, CHAT_BAN_WARNINGS)}/{CHAT_BAN_WARNINGS}
        </p>
        <ul className="mt-3 flex flex-col gap-1 text-left text-[13px]">
          {data.items.map((w) => (
            <li key={w.id} className="rounded-lg bg-zinc-50 px-3 py-2">
              사유: <b>{w.reason}</b>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
          {banned
            ? `경고 ${CHAT_BAN_WARNINGS}회 누적으로 소통방을 더 이상 이용할 수 없어요. 해제는 학생회에 문의해 주세요.`
            : `경고를 ${CHAT_BAN_WARNINGS}번 받으면 소통방을 이용할 수 없어요. 소통방 규칙을 지켜 주세요.`}
        </p>
        <button onClick={close} className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-[15px] font-bold text-white">
          확인
        </button>
      </div>
    </div>
  );
}
