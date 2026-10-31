import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getChatAdminMembers } from "../actions";
import { MemberList } from "./member-list";

export const metadata: Metadata = { title: "소통방 멤버 관리 — C:AI:ender" };

export default async function ChatMembersPage() {
  await requireAdmin();
  const members = await getChatAdminMembers();
  return (
    <div className="flex flex-col gap-3">
      {/* 휴대폰에서도 목록이 바로 보이게 작은 머리줄 */}
      <div className="flex items-center gap-2">
        <Link href="/chat" className="grid size-9 place-items-center rounded-full text-xl hover:bg-brand-soft" aria-label="소통방으로">
          ‹
        </Link>
        <h1 className="text-[17px] font-extrabold tracking-tight md:text-xl">소통방 멤버 관리</h1>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">관리자</span>
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-500">닉네임별 실제 회원·활동·경고·닉네임 변경 기록을 보고, 경고·이용 제한·해제를 할 수 있어요.</p>
      <MemberList members={members} />
    </div>
  );
}
