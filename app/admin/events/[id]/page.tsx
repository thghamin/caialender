import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getEvent } from "@/lib/data/events";
import { kstDateTime } from "@/lib/datetime";
import { Alert, Card } from "@/components/ui";
import { EventForm } from "../event-form";
import { DeleteEventButton } from "./delete-event";

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between text-sm">
        <Link href={event.notice_id ? `/admin/notices/${event.notice_id}` : "/admin"} className="text-zinc-500 hover:text-zinc-900">
          ← {event.notice_id ? "원문 공지" : "관리 홈"}
        </Link>
        <Link href={`/events/${event.id}`} className="text-zinc-500 hover:text-zinc-900">학생 화면으로 보기</Link>
      </div>
      <Card className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">일정 검수·수정</h1>
        {event.missing_fields.length > 0 && (
          <Alert kind="info">AI가 공지에서 찾지 못한 정보: {event.missing_fields.join(", ")}</Alert>
        )}
        <EventForm
          event={event}
          values={{ start: kstDateTime(event.start_at), end: event.end_at ? kstDateTime(event.end_at) : "" }}
        />
        <DeleteEventButton id={event.id} />
      </Card>
    </div>
  );
}
