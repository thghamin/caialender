import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { kstDateTime, requestNow } from "@/lib/datetime";
import { Card } from "@/components/ui";
import { EventForm } from "../event-form";

export default async function NewEventPage({ searchParams }: PageProps<"/admin/events/new">) {
  await requireAdmin();
  // 캘린더에서 빈 날짜를 눌러 들어오면 그날 오전 10시, 그 캘린더로 채워 둔다
  const { date, cal } = await searchParams;
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const calendar = cal === "academic" ? "academic" : "dept";
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Link href={calendar === "academic" ? "/academic" : "/"} className="text-sm text-zinc-500 hover:text-zinc-900">← 캘린더로</Link>
      <Card>
        <h1 className="text-xl font-bold mb-4">일정 직접 추가</h1>
        {/* 날짜 없이 들어오면 지금 이후 가장 가까운 정각 */}
        <EventForm values={{ start: day ? `${day}T10:00` : kstDateTime(new Date(Math.ceil(requestNow() / 3600_000) * 3600_000).toISOString()), end: "" }} defaultCalendar={calendar} />
      </Card>
    </div>
  );
}
