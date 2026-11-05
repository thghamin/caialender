import Link from "next/link";
import { formatKst } from "@/lib/datetime";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { APPROVAL_LABEL, ROLE_LABEL, type ApprovalStatus, type Profile } from "@/lib/types";
import { ApprovalButtons, RoleButton } from "./role-button";

type Member = Profile & { email: string; created_at: string };

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-zinc-100 text-zinc-500",
};

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const me = await requireAdmin();
  const { q: rawQ, sort: rawSort } = await searchParams;
  // 정렬: 기본(총관리자 → 학생회 관리자 → 학생, 같은 권한 안에서는 이름순) / 가입순(최근 가입 먼저) / 이름순(가나다)
  const sort = rawSort === "name" ? "name" : rawSort === "joined" ? "joined" : "role";
  const q = typeof rawQ === "string" ? rawQ.trim().toLowerCase() : "";

  // 이메일은 auth 스키마에만 있어서, 관리자 확인 후 서버에서만 service role로 읽는다
  const db = createServiceClient();
  const [{ data: auth }, { data: profiles }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("profiles").select("id, name, student_no, grade, department, role, approval_status, created_at"),
  ]);
  const emails = new Map(auth.users.map((u) => [u.id, u.email ?? ""]));
  const all: Member[] = (profiles ?? []).map((p) => ({ ...(p as Omit<Member, "email">), email: emails.get(p.id) ?? "" }));
  const waiting = all.filter((m) => m.approval_status === "pending").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const members = all
    .filter((m) => !q || m.email.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.student_no ?? "").includes(q))
    .sort((a, b) =>
      sort === "joined"
        ? b.created_at.localeCompare(a.created_at)
        : (sort === "role" ? ROLE_ORDER[a.role] - ROLE_ORDER[b.role] : 0) || a.name.localeCompare(b.name, "ko") || b.created_at.localeCompare(a.created_at),
    );

  // DB 함수(set_approval)와 같은 규칙: 총관리자·자기 자신은 제외, 관리자의 상태는 총관리자만
  const canApprove = (m: Member) => m.id !== me.id && m.role !== "super_admin" && (m.role === "student" || me.role === "super_admin");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-brand">← 관리 홈</Link>
      <div>
        <h1 className="text-2xl font-bold">👥 회원 관리</h1>
        <p className="text-sm text-zinc-500">
          가입 신청을 승인하면 서비스를 이용할 수 있어요.
          {me.role === "super_admin" ? " 관리자 임명·해제는 총관리자만 할 수 있습니다." : ""}
        </p>
      </div>

      <Card className={waiting.length ? "border-amber-300" : ""}>
        <h2 className="mb-3 text-[1.05rem] font-bold">⏳ 가입 승인 대기 ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-zinc-500">승인을 기다리는 회원이 없습니다.</p>
        ) : (
          <MemberTable members={waiting} me={me} canApprove={canApprove} />
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold">전체 회원 ({all.length})</h2>
          <form className="flex w-full flex-wrap gap-2 sm:w-auto">
            {sort !== "role" && <input type="hidden" name="sort" value={sort} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="이름, 학번, 이메일로 찾기"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-64 sm:flex-none"
            />
            <button className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-100">검색</button>
          </form>
        </div>
        {/* 정렬 버튼: 한 줄로, 설명은 휴대폰에서 아래 줄 */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1" role="group" aria-label="정렬">
          {([["role", "기본"], ["joined", "가입순"], ["name", "이름순"]] as const).map(([k, label]) => (
            <Link
              key={k}
              href={{ pathname: "/admin/members", query: { ...(q ? { q } : {}), ...(k === "role" ? {} : { sort: k }) } }}
              aria-current={sort === k ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${sort === k ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
            >
              {label}
            </Link>
          ))}
          <span className="w-full text-xs text-zinc-400 sm:ml-1 sm:w-auto">
            {sort === "role" ? "총관리자 → 관리자 → 학생 순 · 같은 권한은 이름순" : sort === "joined" ? "최근 가입한 회원부터" : "이름 가나다순"}
          </span>
        </div>
        <MemberTable members={members} me={me} canApprove={canApprove} />
      </Card>
    </div>
  );
}

function MemberTable({ members, me, canApprove }: { members: Member[]; me: Profile; canApprove: (m: Member) => boolean }) {
  if (members.length === 0) return <p className="text-sm text-zinc-500">찾는 회원이 없습니다.</p>;
  const actions = (m: Member) => (
    <>
      {canApprove(m) && <ApprovalButtons userId={m.id} status={m.approval_status} />}
      {me.role === "super_admin" && m.role !== "super_admin" && m.approval_status === "approved" && <RoleButton userId={m.id} role={m.role} />}
    </>
  );
  const badges = (m: Member) => (
    <>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.role === "student" ? "bg-zinc-100 text-zinc-600" : "bg-brand-soft text-brand"}`}>
        {ROLE_LABEL[m.role]}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[m.approval_status]}`}>{APPROVAL_LABEL[m.approval_status]}</span>
    </>
  );
  return (
    <>
    {/* 휴대폰: 회원마다 카드 한 장 (표는 칸이 좁아 글자가 세로로 깨진다) */}
    <ul className="flex flex-col gap-2 md:hidden">
      {members.map((m) => (
        <li key={m.id} className="rounded-xl border border-zinc-200 bg-white p-3" data-testid="member-card">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{m.name || "-"}</span>
            {badges(m)}
          </div>
          <dl className="mt-2 grid grid-cols-[52px_1fr] gap-y-0.5 text-[13px]">
            <dt className="text-zinc-500">학번</dt>
            <dd>{m.student_no ?? "-"}</dd>
            <dt className="text-zinc-500">이메일</dt>
            <dd className="break-all">{m.email}</dd>
            <dt className="text-zinc-500">학과</dt>
            <dd>
              {m.department ?? "-"}
              {m.grade ? ` · ${m.grade}학년` : ""}
            </dd>
            <dt className="text-zinc-500">가입</dt>
            <dd className="tabular-nums" data-testid="member-joined">{joined(m.created_at)}</dd>
          </dl>
          <div className="mt-2 flex flex-wrap justify-end gap-2">{actions(m)}</div>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="border-b border-brand/15 text-left text-xs text-zinc-500">
          <tr>
            <th className="px-2 py-2 font-medium">이름</th>
            <th className="px-2 py-2 font-medium">학번</th>
            <th className="px-2 py-2 font-medium">이메일</th>
            <th className="px-2 py-2 font-medium">학과</th>
            <th className="px-2 py-2 font-medium">학년</th>
            <th className="px-2 py-2 font-medium">권한</th>
            <th className="px-2 py-2 font-medium">승인 상태</th>
            <th className="px-2 py-2 font-medium">가입 일시</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {members.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-2 font-medium">{m.name || "-"}</td>
              <td className="px-2 py-2 text-zinc-600">{m.student_no ?? "-"}</td>
              <td className="px-2 py-2 text-zinc-600">{m.email}</td>
              <td className="px-2 py-2 text-zinc-600">{m.department ?? "-"}</td>
              <td className="px-2 py-2 text-zinc-600">{m.grade ? `${m.grade}학년` : "-"}</td>
              <td className="px-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.role === "student" ? "bg-zinc-100 text-zinc-600" : "bg-brand-soft text-brand"}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              </td>
              <td className="px-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[m.approval_status]}`}>
                  {APPROVAL_LABEL[m.approval_status]}
                </span>
              </td>
              <td className="px-2 py-2 tabular-nums text-zinc-600">{joined(m.created_at)}</td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap justify-end gap-2">
                  {canApprove(m) && <ApprovalButtons userId={m.id} status={m.approval_status} />}
                  {me.role === "super_admin" && m.role !== "super_admin" && m.approval_status === "approved" && (
                    <RoleButton userId={m.id} role={m.role} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

const ROLE_ORDER: Record<Profile["role"], number> = { super_admin: 0, admin: 1, student: 2 };

/** 가입 일시 "2026. 11. 2(월) 15:31" (KST, 분까지) */
const joined = (iso: string) => `${new Date(new Date(iso).getTime() + 9 * 3600_000).getUTCFullYear()}. ${formatKst(iso).replace("월 ", ". ").replace("일", "")}`;

