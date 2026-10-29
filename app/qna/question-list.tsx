import Link from "next/link";
import { formatKst } from "@/lib/datetime";
import { isAdminRole, type Profile } from "@/lib/types";
import type { Question } from "@/lib/data/questions";
import { AnswerForm, DeleteQuestionButton } from "./question-actions";

export function QuestionList({ questions, me, showEvent = true }: { questions: Question[]; me: Profile; showEvent?: boolean }) {
  const admin = isAdminRole(me.role);
  if (questions.length === 0) return <p className="text-sm text-zinc-500">아직 질문이 없어요.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {questions.map((q) => {
        const mine = q.user_id === me.id;
        const who = mine ? "나" : admin && q.author ? `${q.author.name}${q.author.grade ? ` · ${q.author.grade}학년` : ""}` : "학생";
        return (
          <li key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4" data-testid="question">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${q.answered_at ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                {q.answered_at ? "답변 완료" : "답변 대기"}
              </span>
              <span>{who}</span>
              <span>{formatKst(q.created_at)}</span>
              {showEvent && q.event && (
                <Link href={`/events/${q.event.id}`} className="text-brand hover:underline">
                  📅 {q.event.title}
                </Link>
              )}
              {((mine && !q.answered_at) || admin) && (
                <span className="ml-auto">
                  <DeleteQuestionButton id={q.id} />
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium">Q. {q.body}</p>
            {q.answer && (
              <div className="mt-3 rounded-lg bg-brand-soft/60 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-brand">학생회 답변 · {formatKst(q.answered_at!)}</p>
                <p className="whitespace-pre-wrap leading-6 text-zinc-800">{q.answer}</p>
              </div>
            )}
            {admin && (
              <div className="mt-3">
                <AnswerForm id={q.id} current={q.answer} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
