import Link from "next/link";
import { CHAT_BAN_WARNINGS } from "@/lib/chat";
import { formatKst } from "@/lib/datetime";
import { Card } from "@/components/ui";

/** 경고 3회 누적: 소통방 입장 대신 보여 주는 안내 */
export function BanNotice({ warnings }: { warnings: { reason: string; created_at: string }[] }) {
  return (
    <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-8 text-center ring-red-200" data-testid="chat-banned">
      <span className="grid size-16 place-items-center rounded-full bg-red-50 text-3xl" aria-hidden>
        🚫
      </span>
      <h1 className="text-[18px] font-extrabold">소통방을 이용할 수 없어요</h1>
      <p className="text-[13px] leading-relaxed text-zinc-600">
        경고 {CHAT_BAN_WARNINGS}회 누적으로 소통방 이용이 제한되었어요.
        <br />
        제한 해제는 학생회(관리자)에게 문의해 주세요.
      </p>
      {warnings.length > 0 && (
        <ul className="mt-1 flex w-full flex-col gap-1 text-left text-[13px]">
          {warnings.map((w, i) => (
            <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2">
              ⚠️ {w.reason} <span className="text-xs text-zinc-400">· {formatKst(w.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/qna" className="mt-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white">
        학생회에 문의하기
      </Link>
    </Card>
  );
}
