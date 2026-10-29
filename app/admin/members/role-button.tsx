"use client";

import { useState, useTransition } from "react";
import { setMemberApproval, setMemberRole } from "./actions";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string }>, confirmText?: string) =>
    start(async () => {
      if (confirmText && !confirm(confirmText)) return;
      setError((await fn()).error);
    });
  return { pending, error, run };
}

export function RoleButton({ userId, role }: { userId: string; role: "admin" | "student" }) {
  const { pending, error, run } = useAction();
  const next = role === "admin" ? "student" : "admin";
  return (
    <span className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        disabled={pending}
        onClick={() => run(() => setMemberRole(userId, next), next === "student" ? "관리자 권한을 해제할까요?" : undefined)}
        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
          role === "admin" ? "border border-zinc-300 bg-white hover:bg-zinc-100" : "border border-brand/40 text-brand hover:bg-brand-soft"
        }`}
      >
        {pending ? "처리 중…" : role === "admin" ? "관리자 해제" : "관리자로 임명"}
      </button>
    </span>
  );
}

export function ApprovalButtons({ userId, status }: { userId: string; status: "pending" | "approved" | "rejected" }) {
  const { pending, error, run } = useAction();
  return (
    <span className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status !== "approved" && (
        <button
          disabled={pending}
          onClick={() => run(() => setMemberApproval(userId, "approved"))}
          className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          승인
        </button>
      )}
      {status !== "rejected" && (
        <button
          disabled={pending}
          onClick={() => run(() => setMemberApproval(userId, "rejected"), "이 회원의 가입을 거절할까요?")}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
        >
          거절
        </button>
      )}
    </span>
  );
}
