import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { Card } from "@/components/ui";

export default async function NoticesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: notices, error } = await supabase
    .from("notices")
    .select("id, title, posted_at, image_path, body")
    .order("posted_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">학과 공지</h1>
        <p className="text-sm text-zinc-500">공지방에 올라온 원문 공지와 정리된 일정을 확인하세요.</p>
      </div>
      <Card className="p-0">
        {!notices?.length ? (
          <p className="p-5 text-sm text-zinc-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {notices.map((n) => (
              <li key={n.id}>
                <Link href={`/notices/${n.id}`} className="block px-5 py-3 hover:bg-zinc-50">
                  <p className="font-medium">
                    {n.title} {n.image_path && <span title="포스터">🖼️</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatKst(n.posted_at)} · {n.body ? n.body.slice(0, 60).replace(/\s+/g, " ") : "포스터 공지"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
