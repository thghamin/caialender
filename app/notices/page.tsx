import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { Card } from "@/components/ui";
import { PageHero } from "@/components/page-hero";

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
    // 학과 공지는 학과 캘린더와 같은 초록 테마·상단 카드
    <div className="theme-dept mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHero tone="dept" badge="K:AI · 경북대학교 인공지능전공" title="학과 공지" subtitle="공지방에 올라온 원문 공지와, AI가 정리한 일정을 함께 확인하세요." />
      <Card className="p-0! overflow-hidden">
        {!notices?.length ? (
          <p className="p-5 text-sm text-zinc-500">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {notices.map((n) => (
              <li key={n.id}>
                <Link href={`/notices/${n.id}`} className="block px-4 py-3 hover:bg-zinc-50 sm:px-5">
                  <p className="text-[15px] font-semibold leading-snug sm:text-base">
                    {n.title} {n.image_path && <span title="포스터">🖼️</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                    {formatKst(n.posted_at)} · {n.body ? Array.from(n.body).slice(0, 60).join("").replace(/\s+/g, " ") : "포스터 공지" /* 이모지가 반으로 잘리지 않게 글자 단위로 */}
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
