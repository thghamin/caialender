import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { aiConfig } from "@/lib/ai/provider";
import { KindBadge } from "@/components/upcoming-list";
import { Card } from "@/components/ui";
import { NoticeChat } from "./notice-chat";
import type { CalendarEvent, Notice } from "@/lib/types";

export default async function NoticePage({ params }: PageProps<"/notices/[id]">) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: notice } = await supabase.from("notices").select("*").eq("id", id).maybeSingle<Notice>();
  if (!notice) notFound();

  const [{ data: events }, imageUrl] = await Promise.all([
    supabase.from("events").select("*").eq("notice_id", id).eq("status", "published").order("start_at"),
    notice.image_path
      ? supabase.storage.from("posters").createSignedUrl(notice.image_path, 3600).then((r) => r.data?.signedUrl)
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-4">
        <Link href="/notices" className="text-sm text-zinc-500 hover:text-zinc-900">← 공지 목록</Link>
        <Card className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">{formatKst(notice.posted_at)}</p>
          <h1 className="text-xl font-bold">{notice.title}</h1>
          {notice.body && <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-700">{notice.body}</pre>}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="공지 포스터" className="max-h-[700px] w-auto self-start rounded-md border" />
          )}
        </Card>
        {events && events.length > 0 && (
          <Card>
            <h2 className="font-semibold mb-2">이 공지의 일정</h2>
            <ul className="flex flex-col gap-2">
              {(events as CalendarEvent[]).map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="flex items-center gap-2 text-sm hover:text-brand">
                    <KindBadge kind={e.kind} />
                    <span className="text-zinc-500">{formatKst(e.start_at, !e.all_day)}</span>
                    <span className="font-medium">{e.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <NoticeChat noticeId={notice.id} enabled={aiConfig() !== null} />
    </div>
  );
}
