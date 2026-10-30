import Link from "next/link";
import { formatKst, requestNow } from "@/lib/datetime";
import { KIND_LABEL, type CalendarEvent } from "@/lib/types";
import { Card, CardTitle } from "./ui";

export function UpcomingList({ events, title, limit = 8 }: { events: CalendarEvent[]; title: string; limit?: number }) {
  const now = requestNow();
  const upcoming = events
    .filter((e) => new Date(e.end_at ?? e.start_at).getTime() >= now - 86400_000)
    .slice(0, limit);

  return (
    <Card>
      <CardTitle icon="🗓️">{title}</CardTitle>
      {upcoming.length === 0 ? (
        <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">예정된 일정이 없어요.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {upcoming.map((e) => {
            const d = new Date(new Date(e.start_at).getTime() + 9 * 3600_000);
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="group flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-zinc-50">
                  {/* 날짜 타일 */}
                  <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <span className="text-[0.625rem] font-semibold leading-none">{d.getUTCMonth() + 1}월</span>
                    <span className="text-lg font-extrabold leading-tight tabular-nums">{d.getUTCDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-semibold group-hover:text-brand">{e.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <KindBadge kind={e.kind} />
                      {formatKst(e.start_at, !e.all_day).replace(/^\d+월 \d+일/, "")}
                    </span>
                  </span>
                  <DDay iso={e.start_at} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function KindBadge({ kind }: { kind: CalendarEvent["kind"] }) {
  const style =
    kind === "deadline" ? "bg-red-50 text-red-700" : kind === "event" ? "bg-brand-soft text-brand" : "bg-zinc-100 text-zinc-600";
  return <span className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold ${style}`}>{KIND_LABEL[kind]}</span>;
}

function DDay({ iso }: { iso: string }) {
  const kstDay = (t: number) => Math.floor((t + 9 * 3600_000) / 86400_000);
  const diff = kstDay(new Date(iso).getTime()) - kstDay(requestNow());
  if (diff < 0) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${diff <= 3 ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600"}`}
    >
      {diff === 0 ? "D-DAY" : `D-${diff}`}
    </span>
  );
}
