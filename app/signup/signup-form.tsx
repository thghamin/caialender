"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { Alert, Button, Field } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="이름" name="name" required maxLength={30} />
      <Field label="학번" name="student_no" inputMode="numeric" pattern="\d{10}" placeholder="2027012345" required />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">학년</span>
        <select name="grade" defaultValue="1" className="rounded-md border border-zinc-300 bg-white px-3 py-2">
          {[1, 2, 3, 4].map((g) => (
            <option key={g} value={g}>{g}학년</option>
          ))}
        </select>
      </label>
      <Field label="이메일" name="email" type="email" autoComplete="email" required />
      <Field label="비밀번호 (8자 이상)" name="password" type="password" autoComplete="new-password" minLength={8} required />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.message && <Alert kind="info">{state.message}</Alert>}
      <Button disabled={pending}>{pending ? "가입 중…" : "가입하기"}</Button>
      <p className="text-center text-sm text-zinc-500">
        이미 계정이 있나요? <Link href="/login" className="text-brand hover:underline">로그인</Link>
      </p>
    </form>
  );
}
