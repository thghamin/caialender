import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CHAT_BAN_WARNINGS, CHAT_ROOMS, isBanned } from "@/lib/chat";
import { formatKst } from "@/lib/datetime";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { getMyChatMember, getMyRoomAlerts, getMyWarnings, getOpenReportCount } from "./actions";
import { RoomAlertToggle } from "./room-alert-toggle";
import { WarningPopup } from "./warning-popup";
import { NicknameForm } from "./nickname-form";
import { BanNotice } from "./ban-notice";
import { isAdminRole } from "@/lib/types";

export const metadata: Metadata = { title: "학년별 소통방 — C:AI:ender" };

const ROOM_ICON = ["🌱", "🌿", "🌳", "🎓"];

export default async function ChatHome() {
  const me = await requireUser();
  const supabase = await createClient();
  const [member, warnings, openReports, alerts, latest] = await Promise.all([
    getMyChatMember(),
    getMyWarnings(),
    isAdminRole(me.role) ? getOpenReportCount() : Promise.resolve(0),
    getMyRoomAlerts(),
    // 방마다 가장 최근 메시지 (미리보기)
    Promise.all(
      CHAT_ROOMS.map((room) =>
        supabase
          .from("chat_messages")
          .select("body, created_at, deleted_at, author:chat_members!chat_messages_member_id_fkey(nickname)")
          .eq("room", room)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data as { body: string; created_at: string; deleted_at: string | null; author: { nickname: string } } | null),
      ),
    ),
  ]);

  // 경고 3회 누적: 방 목록 대신 이용 제한 안내만
  if (isBanned(member) && !isAdminRole(me.role))
    return (
      <>
        <WarningPopup />
        <BanNotice warnings={warnings} />
      </>
    );

  return (
    <div className="flex flex-col gap-6">
      {!isAdminRole(me.role) && <WarningPopup />}
      <PageHero
        tone="chat"
        badge="닉네임으로 편하게"
        title="학년별 소통방"
        subtitle="수업 정보·휴강·시험 범위·과제·진도처럼 수업에 필요한 정보를 학년별로 자유롭게 나누는 방이에요. 여러 학년 수업을 들으면 여러 방에 들어가도 돼요."
      >
        {isAdminRole(me.role) && (
          <>
            <Link href="/chat/reports" className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-red-600 shadow-sm ring-1 ring-red-200 hover:bg-red-50">
              🚨 신고{openReports ? ` ${openReports}` : ""}
            </Link>
            <Link href="/chat/members" className="rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-zinc-800">
              👥 멤버 관리
            </Link>
          </>
        )}
      </PageHero>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="grid min-w-0 gap-3 sm:grid-cols-2">
          {CHAT_ROOMS.map((room, i) => {
            const last = latest[i];
            return (
              <div
                key={room}
                className="flex min-w-0 items-center gap-2 rounded-[22px] bg-white p-4 pr-3 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-12px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.04] transition hover:ring-brand/30"
              >
                <Link href={`/chat/${room}`} prefetch className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl">{ROOM_ICON[i]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold">{room}학년 소통방</span>
                    <span className="block truncate text-[13px] text-zinc-500">
                      {last ? (last.deleted_at ? "삭제된 메시지" : `${last.author.nickname}: ${last.body}`) : "아직 대화가 없어요. 휴강·시험 범위 소식을 먼저 나눠 보세요!"}
                    </span>
                    {last && <span className="block text-[11px] text-zinc-400">{formatKst(last.created_at)}</span>}
                  </span>
                </Link>
                {/* 방 이름 옆 알림 켜기·끄기 (기본 꺼짐) */}
                <RoomAlertToggle room={room} initialOn={alerts.includes(room)} compact />
              </div>
            );
          })}
        </section>
        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            {member ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-zinc-500">
                  내 닉네임 <b className="text-[15px] text-zinc-900">{member.nickname}</b>
                </p>
                <NicknameForm current={member.nickname} />
              </div>
            ) : (
              <NicknameForm />
            )}
          </Card>
          {member && member.warnings > 0 && (
            <Card className={isBanned(member) ? "ring-red-300" : "ring-amber-300"}>
              <p className={`font-bold ${isBanned(member) ? "text-red-700" : "text-amber-700"}`}>
                ⚠️ 받은 경고 {member.warnings}/{CHAT_BAN_WARNINGS}
              </p>
              <p className="mt-1 text-[13px] text-zinc-600">
                {isBanned(member) ? "경고 3회로 소통방에 글을 쓸 수 없어요. 학생회에 문의하세요." : "경고를 3번 받으면 소통방에 글을 쓸 수 없어요."}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-[13px]">
                {warnings.map((w, i) => (
                  <li key={i} className="rounded-lg bg-zinc-50 px-3 py-1.5">
                    {w.reason} <span className="text-xs text-zinc-400">· {formatKst(w.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="text-[13px] text-zinc-600">
            <p className="mb-1 font-semibold text-zinc-800">소통방 규칙</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>욕설·비방·도배·광고·개인정보 노출은 삭제되고 경고를 받아요.</li>
              <li>경고 {CHAT_BAN_WARNINGS}회면 소통방에 글을 쓸 수 없어요.</li>
              <li>닉네임만 보이지만, 학생회는 문제가 된 글의 작성자를 확인할 수 있어요.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
