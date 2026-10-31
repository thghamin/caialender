import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PageHero } from "@/components/page-hero";
import { getChatAdminMembers } from "../actions";
import { MemberList } from "./member-list";

export const metadata: Metadata = { title: "소통방 멤버 관리 — C:AI:ender" };

export default async function ChatMembersPage() {
  await requireAdmin();
  const members = await getChatAdminMembers();
  return (
    <div className="flex flex-col gap-6">
      <PageHero badge="관리자 전용" title="소통방 멤버 관리" subtitle="닉네임별 실제 회원, 활동, 경고·닉네임 변경 기록을 보고 경고·이용 제한·해제를 할 수 있어요.">
        <Link href="/chat" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">
          ← 소통방으로
        </Link>
      </PageHero>
      <MemberList members={members} />
    </div>
  );
}
