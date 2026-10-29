import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEvent, getInterestIds, getPersonalEvents, getPublishedEvents, pickMyEvents } from "@/lib/data/events";
import { findConflicts } from "@/lib/conflicts";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { targetLabel } from "@/lib/calendar-items";
import { CALENDAR_LABEL } from "@/lib/types";
import { Alert, Card } from "@/components/ui";
import { InterestButton } from "./interest-button";
import { getQuestions } from "@/lib/data/questions";
import { AskForm } from "@/app/qna/ask-form";
import { QuestionList } from "@/app/qna/question-list";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const [event, user] = await Promise.all([getEvent(id), requireUser()]);
  if (!event) notFound();

  const supabase = await createClient();
  const [{ data: notice }, { data: changes }] = await Promise.all([
    event.notice_id && user
      ? supabase.from("notices").select("id, title, posted_at").eq("id", event.notice_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("event_changes")
          .select("id, summary, created_at")
          .eq("event_id", id)
          .eq("status", "applied")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const questions = user ? await getQuestions({ eventId: id }) : [];
  let interested = false;
  let conflicts: { id: string; title: string; start_at: string }[] = [];
  if (user) {
    const [interests, personal, events] = await Promise.all([
      getInterestIds(user.id),
      getPersonalEvents(user.id),
      getPublishedEvents(),
    ]);
    interested = interests.has(id);
    conflicts = findConflicts(event, [...pickMyEvents(events, user, interests), ...personal]);
  }

  const when = event.end_at
    ? `${formatKst(event.start_at, !event.all_day)} ~ ${formatKst(event.end_at, !event.all_day)}`
    : formatKst(event.start_at, !event.all_day);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Link href={event.calendar === "academic" ? "/academic" : "/"} className="text-sm text-zinc-500 hover:text-brand">
        ← {CALENDAR_LABEL[event.calendar]}로
      </Link>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${event.calendar === "academic" ? "bg-zinc-600" : "bg-brand"}`}
          >
            {CALENDAR_LABEL[event.calendar]}
          </span>
          <KindBadge kind={event.kind} />
          {event.status !== "published" && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              {event.status === "draft" ? "검수 대기" : "보관됨"}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">일시</dt>
          <dd>{when}</dd>
          <dt className="text-zinc-500">장소</dt>
          <dd>
            {event.location ?? <span className="text-zinc-400">{event.calendar === "academic" ? "-" : "공지에 없음"}</span>}
          </dd>
          <dt className="text-zinc-500">대상</dt>
          <dd>{targetLabel(event)}</dd>
        </dl>
        {event.description && <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{event.description}</p>}
        {event.missing_fields.length > 0 && (
          <Alert kind="info">공지에 다음 정보가 없습니다: {event.missing_fields.join(", ")}. 학생회에 문의하세요.</Alert>
        )}
        {conflicts.length > 0 && (
          <Alert kind="error">
            내 일정과 시간이 겹칩니다:{" "}
            {conflicts.map((c) => `${c.title}(${formatKst(c.start_at)})`).join(", ")}
          </Alert>
        )}
        {changes && changes.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800 mb-1">변경 이력</p>
            <ul className="list-disc pl-5 text-amber-900">
              {changes.map((c) => (
                <li key={c.id}>
                  {c.summary} <span className="text-amber-600">({formatKst(c.created_at)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {user ? (
            <InterestButton eventId={event.id} active={interested} />
          ) : (
            <Link href={`/login?next=/events/${event.id}`} className="text-sm text-brand hover:underline">
              로그인하고 내 캘린더에 추가하기
            </Link>
          )}
          {notice && (
            <Link href={`/notices/${notice.id}`} className="text-sm text-zinc-600 hover:text-zinc-900">
              📄 원문 공지 보기
            </Link>
          )}
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">💬 이 일정에 대한 질문 {questions.length > 0 && <span className="text-brand">{questions.length}</span>}</h2>
        {user ? (
          <>
            <QuestionList questions={questions} me={user} showEvent={false} />
            <AskForm eventId={event.id} />
          </>
        ) : (
          <Link href={`/login?next=/events/${event.id}`} className="text-sm text-brand hover:underline">
            로그인하고 학생회에 질문하기
          </Link>
        )}
      </Card>
    </div>
  );
}
