import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { Card } from "@/components/ui";
import { NoticeStatusBadge } from "./status-badge";
import { ChangeActions } from "./change-actions";
import { AcademicImportForm } from "./academic-import";
import { countPendingQuestions } from "@/lib/data/questions";
import { MetricsCard } from "./metrics-card";
import type { CalendarEvent, Notice } from "@/lib/types";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: notices }, { data: drafts }, { data: changes }, { count: academicCount }] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, status, posted_at, last_error, image_path")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("events").select("*").eq("status", "draft").order("start_at"),
    supabase
      .from("event_changes")
      .select("id, summary, created_at, event_id, notice_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("calendar", "academic"),
  ]);
  const [pendingQuestions, { count: pendingMembers }] = await Promise.all([
    countPendingQuestions(),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">학생회 관리</h1>
          <p className="text-[13px] text-zinc-500 md:text-sm">공지 문구나 포스터 사진을 올리면 AI가 일정 초안을 만들고, 검수 후 학과 캘린더에 게시합니다.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <Link href="/admin/members" className="rounded-md border border-brand/40 bg-white px-4 py-2 font-medium text-brand hover:bg-brand-soft text-center text-[13px] md:text-sm">
            👥 회원 관리{pendingMembers ? ` (승인 대기 ${pendingMembers})` : ""}
          </Link>
          <Link href="/chat/members" className="rounded-md border border-zinc-300 bg-white px-4 py-2 hover:bg-zinc-100 text-center text-[13px] md:text-sm">
            👥 소통방 멤버 관리
          </Link>
          <Link href="/admin/events/new" className="rounded-md border border-zinc-300 bg-white px-4 py-2 hover:bg-zinc-100 text-center text-[13px] md:text-sm">
            일정 직접 추가
          </Link>
          <Link href="/admin/notices/new" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:opacity-90 text-center text-[13px] md:text-sm">
            + 공지 등록
          </Link>
        </div>
      </div>

      <MetricsCard />

      <Link
        href="/qna?status=pending"
        className={`flex items-center justify-between rounded-2xl border p-4 text-sm shadow-sm ${
          pendingQuestions ? "border-brand/40 bg-brand-soft text-brand" : "border-brand/15 bg-white text-zinc-600"
        }`}
      >
        <span className="font-semibold">💬 답변을 기다리는 학생 질문 {pendingQuestions}개</span>
        <span>질문 게시판에서 답변하기 →</span>
      </Link>

      {changes && changes.length > 0 && (
        <Card className="border-amber-300">
          <h2 className="mb-3 text-[1.05rem] font-bold">⚠️ AI가 감지한 일정 변경 ({changes.length})</h2>
          <ul className="flex flex-col gap-3">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {c.summary}{" "}
                  <Link href={`/admin/notices/${c.notice_id}`} className="text-zinc-400 hover:text-brand">
                    (근거 공지)
                  </Link>
                </span>
                <ChangeActions id={c.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-[1.05rem] font-bold">검수 대기 일정 ({drafts?.length ?? 0})</h2>
        {!drafts?.length ? (
          <p className="text-sm text-zinc-500">검수할 일정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(drafts as CalendarEvent[]).map((e) => (
              <li key={e.id} className="py-2">
                <Link href={`/admin/events/${e.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:text-brand">
                  <KindBadge kind={e.kind} />
                  <span className="text-zinc-500 sm:w-36">{formatKst(e.start_at, !e.all_day)}</span>
                  <span className="font-medium">{e.title}</span>
                  {e.missing_fields.length > 0 && (
                    <span className="text-xs text-amber-600">누락: {e.missing_fields.join(", ")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-bold">🎓 학사 캘린더</h2>
          <p className="text-sm text-zinc-500">
            경북대 홈페이지 학사일정을 불러와 학사 캘린더에 게시합니다. 현재 {academicCount ?? 0}건. 다시 불러와도 중복되지 않아요.
          </p>
        </div>
        <AcademicImportForm />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[1.05rem] font-bold">최근 공지</h2>
          <Link href="/admin/events" className="text-sm text-zinc-500 hover:text-brand">전체 일정 관리 →</Link>
        </div>
        {!notices?.length ? (
          <p className="text-sm text-zinc-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(notices as Notice[]).map((n) => (
              <li key={n.id} className="py-2">
                <Link href={`/admin/notices/${n.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm hover:text-brand">
                  <NoticeStatusBadge status={n.status} />
                  <span className="text-zinc-500 sm:w-36">{formatKst(n.posted_at)}</span>
                  <span className="font-medium">{n.title}</span>
                  {n.image_path && <span title="포스터 첨부">🖼️</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
