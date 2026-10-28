import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { KindBadge } from "@/components/upcoming-list";
import { Card } from "@/components/ui";
import type { CalendarEvent } from "@/lib/types";

const TABS = [
  ["published", "게시됨"],
  ["draft", "검수 대기"],
  ["archived", "보관"],
] as const;

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.some(([k]) => k === raw) ? (raw as string) : "published";
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("status", status).order("start_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← 관리 홈</Link>
      <h1 className="text-2xl font-bold">전체 일정 관리</h1>
      <div className="flex gap-2 text-sm">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/events?status=${k}`}
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
