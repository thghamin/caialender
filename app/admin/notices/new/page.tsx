import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { kstDateTime } from "@/lib/datetime";
import { Card } from "@/components/ui";
import { NoticeForm } from "./notice-form";

export default async function NewNoticePage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← 관리 홈</Link>
      <Card>
        <h1 className="text-xl font-bold mb-4">공지 등록</h1>
        <NoticeForm now={kstDateTime(new Date().toISOString())} />
      </Card>
    </div>
  );
}
