import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { Card } from "@/components/ui";
import { CALENDAR_LABEL, type CalendarEvent } from "@/lib/types";

const TABS = [
  ["published", "게시됨"],
  ["draft", "검수 대기"],
  ["archived", "보관"],
] as const;

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const { status: raw, cal: rawCal } = await searchParams;
  const status = TABS.some(([k]) => k === raw) ? (raw as string) : "published";
  const cal = rawCal === "academic" ? "academic" : "dept";
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("status", status)
    .eq("calendar", cal)
    .order("start_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← 관리 홈</Link>
      <h1 className="text-2xl font-bold">전체 일정 관리</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["dept", "academic"] as const).map((c) => (
          <Link
            key={c}
            href={`/admin/events?cal=${c}&status=${status}`}
            className={`rounded-full px-3 py-1 ${c === cal ? "bg-brand text-white" : "border border-zinc-300 bg-white"}`}
          >
            {CALENDAR_LABEL[c]}
          </Link>
        ))}
        <span className="mx-1 w-px bg-zinc-300" />
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/events?cal=${cal}&status=${k}`}
            className={`rounded-md px-3 py-1 ${k === status ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Card>
        {!data?.length ? (
          <p className="text-sm text-zinc-500">일정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(data as CalendarEvent[]).map((e) => (
              <li key={e.id} className="py-2">
                <Link href={`/admin/events/${e.id}`} className="flex items-center gap-2 text-sm hover:text-brand">
                  <KindBadge kind={e.kind} />
                  <span className="w-40 text-zinc-500">{formatKst(e.start_at, !e.all_day)}</span>
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-auto text-xs text-zinc-400">
                    {e.target_grades.length ? `${e.target_grades.join("·")}학년` : "전체"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
