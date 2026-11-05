import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatKst } from "@/lib/datetime";
import { Card } from "@/components/ui";
import { HandledButton } from "./handled-button";

export const metadata: Metadata = { title: "베타 의견 — C:AI:ender" };

/** 관리자: 화면 맨 아래 '의견 남기기'로 들어온 베타 의견 (새 의견 먼저) */
export default async function FeedbackPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("feedback").select("id, user_id, body, page, handled, created_at").order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  // 보낸 사람 이름·학년은 관리자만 (서버에서만 service role로 읽는다)
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: people } = ids.length
    ? await createServiceClient().from("profiles").select("id, name, grade").in("id", ids)
    : { data: [] as { id: string; name: string; grade: number | null }[] };
  const who = new Map((people ?? []).map((p) => [p.id, `${p.name}${p.grade ? ` · ${p.grade}학년` : ""}`]));
  const list = [...(rows ?? [])].sort((a, b) => Number(a.handled) - Number(b.handled));
  const fresh = list.filter((r) => !r.handled).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-brand">← 관리 홈</Link>
      <div>
        <h1 className="text-2xl font-bold">💬 베타 의견</h1>
        <p className="text-sm text-zinc-500">화면 맨 아래 &apos;의견 남기기&apos;로 학생들이 보낸 의견이에요. 학생회(관리자)만 볼 수 있어요. 새 의견 {fresh}개</p>
      </div>
      {!list.length ? (
        <Card>
          <p className="text-sm text-zinc-500">아직 들어온 의견이 없어요.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <li key={r.id} data-testid="feedback-item">
              <Card className={r.handled ? "opacity-60" : "ring-sky-200"}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${r.handled ? "bg-zinc-100 text-zinc-500" : "bg-sky-50 text-sky-700"}`}>{r.handled ? "확인함" : "새 의견"}</span>
                  <span>{formatKst(r.created_at)}</span>
                  <span>· {who.get(r.user_id) ?? "탈퇴한 회원"}</span>
                  {r.page && <span>· 보낸 화면 {r.page}</span>}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{r.body}</p>
                <div className="mt-3 flex justify-end">
                  <HandledButton id={r.id} handled={r.handled} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
