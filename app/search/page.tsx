import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { Card, CardTitle } from "@/components/ui";
import { KindBadge } from "@/components/upcoming-list";
import { CALENDAR_LABEL, type CalendarEvent } from "@/lib/types";

export const metadata: Metadata = { title: "검색 — C:AI:ender" };

/** PostgREST or 필터에 넣을 검색어: 쉼표·괄호·와일드카드를 지워 필터 문법을 깨지 않게 */
const clean = (q: string) => q.replace(/[%_,()*\\\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? clean(raw) : "";
  const supabase = await createClient();
  const like = `%${q}%`;

  const [events, notices, questions] = q
    ? await Promise.all([
        supabase
          .from("events")
          .select("id, title, kind, calendar, start_at, all_day, location")
          .eq("status", "published")
          .or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`)
          .order("start_at", { ascending: false })
          .limit(30),
        supabase.from("notices").select("id, title, posted_at").or(`title.ilike.${like},body.ilike.${like}`).order("posted_at", { ascending: false }).limit(15),
        supabase.from("questions").select("id, body, answer, event_id, created_at").or(`body.ilike.${like},answer.ilike.${like}`).order("created_at", { ascending: false }).limit(15),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const ev = (events.data ?? []) as Pick<CalendarEvent, "id" | "title" | "kind" | "calendar" | "start_at" | "all_day" | "location">[];
  const total = ev.length + (notices.data?.length ?? 0) + (questions.data?.length ?? 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="일정·공지·질문 검색 (예: MT, 수강신청, 장학금)"
          aria-label="검색어"
          className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button className="rounded-2xl bg-brand px-5 font-semibold text-white shadow-sm">검색</button>
      </form>

      {q && <p className="text-sm text-zinc-500">‘{q}’ 검색 결과 {total}개</p>}

      {q && ev.length > 0 && (
        <Card>
          <CardTitle icon="🗓️">일정 {ev.length}</CardTitle>
          <ul className="flex flex-col">
            {ev.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-zinc-50">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white ${e.calendar === "academic" ? "bg-[#c41b22]" : "bg-[#15803d]"}`}>
                    {CALENDAR_LABEL[e.calendar].replace(" 캘린더", "")}
                  </span>
                  <KindBadge kind={e.kind} />
                  <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{formatKst(e.start_at, !e.all_day)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {q && (notices.data?.length ?? 0) > 0 && (
        <Card>
          <CardTitle icon="📄">공지 {notices.data!.length}</CardTitle>
          <ul className="flex flex-col">
            {notices.data!.map((n) => (
              <li key={n.id}>
                <Link href={`/notices/${n.id}`} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-zinc-50">
                  <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{formatKst(n.posted_at, false)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {q && (questions.data?.length ?? 0) > 0 && (
        <Card>
          <CardTitle icon="💬">질문 {questions.data!.length}</CardTitle>
          <ul className="flex flex-col">
            {questions.data!.map((x) => (
              <li key={x.id}>
                <Link href={x.event_id ? `/events/${x.event_id}` : "/qna"} className="block rounded-xl px-2 py-2 hover:bg-zinc-50">
                  <span className="block truncate font-medium">Q. {x.body}</span>
                  {x.answer && <span className="block truncate text-sm text-zinc-500">A. {x.answer}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {q && total === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">찾는 결과가 없어요. 다른 말로 검색해 보세요.</p>}
      {!q && <p className="text-center text-sm text-zinc-500">학과·학사 일정, 공지, 질문과 답변을 한 번에 찾아요.</p>}
    </div>
  );
}
