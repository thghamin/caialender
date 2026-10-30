import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { Alert, Card } from "@/components/ui";
import { NoticeStatusBadge } from "../../status-badge";
import { ChangeActions } from "../../change-actions";
import { AutoRefresh } from "./auto-refresh";
import { DeleteNoticeButton, PublishAllButton, ReanalyzeButton } from "./notice-actions";
import { noticeImages, type CalendarEvent, type Notice } from "@/lib/types";
import { NoticeImages } from "@/components/notice-images";
import { EvidenceText } from "@/components/evidence-text";

export default async function AdminNoticePage({ params }: PageProps<"/admin/notices/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: notice } = await supabase.from("notices").select("*").eq("id", id).maybeSingle<Notice>();
  if (!notice) notFound();

  const [{ data: events }, { data: changes }] = await Promise.all([
    supabase.from("events").select("*").eq("notice_id", id).order("start_at"),
    supabase.from("event_changes").select("id, summary, status").eq("notice_id", id),
  ]);
  const drafts = ((events ?? []) as CalendarEvent[]).filter((e) => e.status === "draft");
  const working = notice.status === "queued" || notice.status === "processing";
  const dropped = (notice.ai_result as { dropped?: string[] } | null)?.dropped ?? [];

  return (
    <div className="flex flex-col gap-4">
      {working && <AutoRefresh />}
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← 관리 홈</Link>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <NoticeStatusBadge status={notice.status} />
            <span className="text-xs text-zinc-500">게시 {formatKst(notice.posted_at)}</span>
          </div>
          <h1 className="text-xl font-bold">{notice.title}</h1>
          {notice.body && <EvidenceText body={notice.body} evidences={((events ?? []) as CalendarEvent[]).map((e) => e.evidence)} />}
          {notice.body && events && events.some((e) => e.evidence) && (
            <p className="text-xs text-zinc-500"><mark className="rounded bg-amber-200/70 px-1">형광펜</mark> = AI가 일정을 뽑은 근거 문장</p>
          )}
          <NoticeImages paths={noticeImages(notice)} expiresIn={600} />
          <div className="flex gap-2 pt-2">
            {!working && <ReanalyzeButton id={notice.id} />}
            <DeleteNoticeButton id={notice.id} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {working && (
            <Alert kind="info">
              AI가 공지를 분석하고 있습니다… (시도 {notice.attempts}회). 이 화면은 자동으로 새로고침됩니다.
            </Alert>
          )}
          {notice.status === "failed" && (
            <Alert kind="error">AI 분석 실패: {notice.last_error}. 다시 분석하거나 일정을 직접 추가하세요.</Alert>
          )}
          {notice.status === "analyzed" && (
            <p className="text-xs text-zinc-500">
              {notice.ai_model} · {notice.analyzed_at && formatKst(notice.analyzed_at)} 분석
              {dropped.length > 0 && ` · 해석하지 못한 항목 ${dropped.length}개: ${dropped.join(" / ")}`}
            </p>
          )}

          {changes && changes.length > 0 && (
            <Card className="border-amber-300">
              <h2 className="font-semibold mb-2">기존 일정 변경 감지</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {changes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.summary}</span>
                    {c.status === "pending" ? <ChangeActions id={c.id} /> : <span className="text-xs text-zinc-500">{c.status === "applied" ? "반영됨" : "무시됨"}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[1.05rem] font-bold">추출된 일정 ({events?.length ?? 0})</h2>
              {drafts.length > 0 && <PublishAllButton noticeId={notice.id} count={drafts.length} />}
            </div>
            {notice.status === "analyzed" && !events?.length && !changes?.length && (
              <p className="text-sm text-zinc-500">이 공지에서 일정을 찾지 못했습니다.</p>
            )}
            <ul className="flex flex-col gap-3">
              {((events ?? []) as CalendarEvent[]).map((e) => (
                <li key={e.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <KindBadge kind={e.kind} />
                    <span className={`text-[0.6875rem] ${e.status === "published" ? "text-green-700" : "text-amber-600"}`}>
                      {e.status === "published" ? "게시됨" : e.status === "draft" ? "검수 대기" : "보관"}
                    </span>
                    <Link href={`/admin/events/${e.id}`} className="ml-auto text-brand hover:underline">검수·수정</Link>
                  </div>
                  <p className="mt-1 font-medium">{e.title}</p>
                  <p className="text-zinc-500">
                    {formatKst(e.start_at, !e.all_day)}
                    {e.end_at && ` ~ ${formatKst(e.end_at, !e.all_day)}`} · {e.location ?? "장소 없음"} ·{" "}
                    {e.target_grades.length ? `${e.target_grades.join("·")}학년` : "전체"}
                  </p>
                  {e.evidence && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-zinc-700">🤖 근거: “{e.evidence}”</p>
                  )}
                  {e.missing_fields.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ 공지에 없는 정보: {e.missing_fields.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
