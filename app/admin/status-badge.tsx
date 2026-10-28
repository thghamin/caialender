import type { Notice } from "@/lib/types";

const STYLE: Record<Notice["status"], [string, string]> = {
  queued: ["분석 대기", "bg-zinc-100 text-zinc-600"],
  processing: ["AI 분석 중", "bg-blue-50 text-blue-700"],
  analyzed: ["분석 완료", "bg-green-50 text-green-700"],
  failed: ["분석 실패", "bg-red-50 text-red-700"],
};

export function NoticeStatusBadge({ status }: { status: Notice["status"] }) {
  const [label, style] = STYLE[status];
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>{label}</span>;
}
