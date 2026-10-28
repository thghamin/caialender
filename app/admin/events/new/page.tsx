import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { kstDateTime } from "@/lib/datetime";
import { Card } from "@/components/ui";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← 관리 홈</Link>
      <Card>
        <h1 className="text-xl font-bold mb-4">일정 직접 추가</h1>
        <EventForm values={{ start: kstDateTime(new Date().toISOString()), end: "" }} />
      </Card>
    </div>
  );
}
