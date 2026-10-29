import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { Hobanu } from "@/components/hobanu";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "가입 승인 대기 — C:AI:ender" };

/** 승인 전(대기·거절) 회원이 볼 수 있는 유일한 화면 */
export default async function PendingPage() {
  const user = await requireSignedIn();
  if (user.approval_status === "approved") redirect("/my");
  const rejected = user.approval_status === "rejected";

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card className="flex flex-col items-center gap-3 text-center">
        <Hobanu className="size-24" title="" />
        <h1 className="text-xl font-bold">{rejected ? "가입이 승인되지 않았어요" : "가입 승인을 기다리고 있어요"}</h1>
        <p className="text-sm leading-6 text-zinc-600">
          {rejected ? (
            <>입력한 정보로는 가입이 거절되었습니다. 학번·학과 정보를 확인한 뒤 학생회에 문의해 주세요.</>
          ) : (
            <>
              <b>{user.name}</b>님, 회원가입이 접수되었습니다.
              <br />
              학생회 관리자가 승인하면 캘린더와 공지, 질문 게시판을 이용할 수 있어요.
            </>
          )}
        </p>
        <dl className="mt-1 grid w-full grid-cols-[72px_1fr] gap-y-1 rounded-lg bg-zinc-50 p-3 text-left text-sm">
          <dt className="text-zinc-500">학번</dt>
          <dd>{user.student_no ?? "-"}</dd>
          <dt className="text-zinc-500">학과·학년</dt>
          <dd>
            {user.department ?? "-"}
            {user.grade ? ` · ${user.grade}학년` : ""}
          </dd>
        </dl>
        <form action={logout}>
          <button className="mt-2 rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100">로그아웃</button>
        </form>
      </Card>
    </div>
  );
}
