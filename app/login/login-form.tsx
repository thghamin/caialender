"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/auth/actions";
import { Alert, Button, Field } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="이메일" name="email" type="email" autoComplete="email" required />
      <Field label="비밀번호" name="password" type="password" autoComplete="current-password" required />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <Button disabled={pending}>{pending ? "로그인 중…" : "로그인"}</Button>
      <p className="text-center text-sm text-zinc-500">
        계정이 없나요? <Link href="/signup" className="text-brand hover:underline">회원가입</Link>
      </p>
    </form>
  );
}
