import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getQuestions } from "@/lib/data/questions";
import { getEvent } from "@/lib/data/events";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { AskForm } from "./ask-form";
import { QuestionList } from "./question-list";

export const metadata: Metadata = { title: "질문 게시판 — C:AI:ender" };

const TABS = [
  ["all", "전체"],
  ["pending", "답변 대기"],
  ["answered", "답변 완료"],
] as const;

export default async function QnaPage({ searchParams }: PageProps<"/qna">) {
  const me = await requireUser();
  const { status: rawStatus, event: rawEvent } = await searchParams;
  const status = rawStatus === "pending" || rawStatus === "answered" ? rawStatus : "all";
  const event = typeof rawEvent === "string" && /^[0-9a-f-]{36}$/.test(rawEvent) ? await getEvent(rawEvent) : null;
  const questions = await getQuestions({ status: status === "all" ? undefined : status });

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        badge="학생회에게 물어보세요"
        title="질문 게시판"
        subtitle="일정이나 공지에서 궁금한 점을 남기면 학생회가 직접 답변해요. 답변은 모든 학생이 함께 볼 수 있어요."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex gap-2 text-sm">
            {TABS.map(([k, label]) => (
              <Link
                key={k}
                href={k === "all" ? "/qna" : `/qna?status=${k}`}
                className={`rounded-full px-3 py-1 ${k === status ? "bg-brand text-white" : "border border-zinc-300 bg-white hover:bg-zinc-50"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <QuestionList questions={questions} me={me} />
        </section>
        <aside className="min-w-0">
          <Card className="lg:sticky lg:top-24">
            <h2 className="mb-3 text-[1.05rem] font-bold">✍️ 질문 남기기</h2>
            <AskForm eventId={event?.id} eventTitle={event?.title} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
