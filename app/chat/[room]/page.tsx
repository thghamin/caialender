import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CHAT_ROOMS, isBanned, parseRoom } from "@/lib/chat";
import { isAdminRole } from "@/lib/types";
import { Card } from "@/components/ui";
import { getChatMessages, getMyChatMember, getMyWarnings } from "../actions";
import { BanNotice } from "../ban-notice";
import { NicknameForm } from "../nickname-form";
import { ChatRoomView } from "./chat-room";

export const metadata: Metadata = { title: "소통방 — C:AI:ender" };

export default async function ChatRoomPage({ params }: PageProps<"/chat/[room]">) {
  const room = parseRoom((await params).room);
  if (!room) notFound();
  const me = await requireUser();
  const [member, messages] = await Promise.all([getMyChatMember(), getChatMessages(room)]);
  // 경고 3회 누적: 방에 들어올 수 없다 (메시지도 DB 권한에서 막혀 있다)
  if (isBanned(member) && !isAdminRole(me.role)) return <BanNotice warnings={await getMyWarnings()} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link href="/chat" className="grid size-9 place-items-center rounded-full text-xl hover:bg-brand-soft" aria-label="소통방 목록">
          ‹
        </Link>
        <h1 className="whitespace-nowrap text-lg font-extrabold tracking-tight sm:text-xl">{room}학년 소통방</h1>
        {/* 다른 학년 방으로 바로 이동 */}
        <nav className="ml-auto flex gap-1" aria-label="다른 학년 방">
          {CHAT_ROOMS.map((r) => (
            <Link
              key={r}
              href={`/chat/${r}`}
              prefetch
              aria-current={r === room ? "page" : undefined}
              className={`grid size-8 place-items-center rounded-full text-sm font-bold sm:size-9 ${r === room ? "bg-brand text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200"}`}
            >
              {r}
            </Link>
          ))}
        </nav>
      </div>
      <p className="-mt-1 text-sm text-zinc-500">📚 수업 정보 · 휴강 · 시험 범위 · 과제 · 진도를 자유롭게 공유해요</p>
      {member ? (
        <ChatRoomView room={room} initial={messages} member={member} admin={isAdminRole(me.role)} />
      ) : (
        <Card className="mx-auto w-full max-w-md">
          <p className="mb-3 text-lg font-bold">닉네임을 정하고 들어가요</p>
          <NicknameForm />
        </Card>
      )}
    </div>
  );
}
