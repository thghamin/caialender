import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { Card } from "@/components/ui";
import { NoticeStatusBadge } from "./status-badge";
import { ChangeActions } from "./change-actions";
import type { CalendarEvent, Notice } from "@/lib/types";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: notices }, { data: drafts }, { data: changes }] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">학생회 기획부 관리</h1>
          <p className="text-sm text-zinc-500">공지를 등록하면 AI가 일정 초안을 만들고, 검수 후 게시합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/events/new" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100">
            일정 직접 추가
          </Link>
          <Link href="/admin/notices/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            + 공지 등록
          </Link>
        </div>
      </div>

      {changes && changes.length > 0 && (
        <Card className="border-amber-300">
          <h2 className="font-semibold mb-3">⚠️ AI가 감지한 일정 변경 ({changes.length})</h2>
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
        <h2 className="font-semibold mb-3">검수 대기 일정 ({drafts?.length ?? 0})</h2>
        {!drafts?.length ? (
          <p className="text-sm text-zinc-500">검수할 일정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(drafts as CalendarEvent[]).map((e) => (
              <li key={e.id} className="py-2">
                <Link href={`/admin/events/${e.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:text-brand">
                  <KindBadge kind={e.kind} />
                  <span className="text-zinc-500 w-36">{formatKst(e.start_at, !e.all_day)}</span>
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

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">최근 공지</h2>
          <Link href="/admin/events" className="text-sm text-zinc-500 hover:text-brand">전체 일정 관리 →</Link>
        </div>
        {!notices?.length ? (
          <p className="text-sm text-zinc-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(notices as Notice[]).map((n) => (
              <li key={n.id} className="py-2">
                <Link href={`/admin/notices/${n.id}`} className="flex items-center gap-3 text-sm hover:text-brand">
                  <NoticeStatusBadge status={n.status} />
                  <span className="text-zinc-500 w-36">{formatKst(n.posted_at)}</span>
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
