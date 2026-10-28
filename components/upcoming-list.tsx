import Link from "next/link";
import { formatKst, requestNow } from "@/lib/datetime";
import { KIND_LABEL, type CalendarEvent } from "@/lib/types";
import { Card } from "./ui";

export function UpcomingList({ events, title, limit = 8 }: { events: CalendarEvent[]; title: string; limit?: number }) {
  const now = requestNow();
  const upcoming = events
    .filter((e) => new Date(e.end_at ?? e.start_at).getTime() >= now - 86400_000)
    .slice(0, limit);

  return (
    <Card>
      <h2 className="font-semibold mb-3">{title}</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-zinc-500">예정된 일정이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="group block">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <KindBadge kind={e.kind} />
                  {formatKst(e.start_at, !e.all_day)}
                  <DDay iso={e.start_at} />
                </div>
                <p className="text-sm font-medium group-hover:text-brand">{e.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function KindBadge({ kind }: { kind: CalendarEvent["kind"] }) {
  const style =
    kind === "deadline" ? "bg-red-50 text-red-700" : kind === "event" ? "bg-indigo-50 text-indigo-700" : "bg-cyan-50 text-cyan-700";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>{KIND_LABEL[kind]}</span>;
}

function DDay({ iso }: { iso: string }) {
  const kstDay = (t: number) => Math.floor((t + 9 * 3600_000) / 86400_000);
  const diff = kstDay(new Date(iso).getTime()) - kstDay(requestNow());
  if (diff < 0) return null;
  return <span className="font-semibold text-brand">{diff === 0 ? "D-DAY" : `D-${diff}`}</span>;
}
