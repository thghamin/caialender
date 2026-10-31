import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getChatReports } from "../actions";
import { ReportList } from "./report-list";

export const metadata: Metadata = { title: "소통방 신고 — C:AI:ender" };

export default async function ChatReportsPage({ searchParams }: PageProps<"/chat/reports">) {
  await requireAdmin();
  const all = (await searchParams).all === "1";
  const reports = await getChatReports(!all);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link href="/chat" className="grid size-9 place-items-center rounded-full text-xl hover:bg-brand-soft" aria-label="소통방으로">
          ‹
        </Link>
        <h1 className="text-[17px] font-extrabold tracking-tight md:text-xl">소통방 신고</h1>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">관리자</span>
        <Link href="/chat/members" className="ml-auto text-[13px] text-zinc-500 underline-offset-2 hover:underline">
          멤버 관리 →
        </Link>
      </div>
      <div className="flex gap-1.5 text-[13px]">
        <Link href="/chat/reports" className={`rounded-full px-3 py-1 ${!all ? "bg-brand text-white" : "bg-white ring-1 ring-zinc-200"}`}>
          처리 대기
        </Link>
        <Link href="/chat/reports?all=1" className={`rounded-full px-3 py-1 ${all ? "bg-brand text-white" : "bg-white ring-1 ring-zinc-200"}`}>
          전체 기록
        </Link>
      </div>
      <ReportList reports={reports} />
    </div>
  );
}
