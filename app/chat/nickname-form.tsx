"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nicknameError } from "@/lib/chat";
import { setNickname } from "./actions";

/** 소통방 닉네임 정하기·바꾸기 */
export function NicknameForm({ current, onDone }: { current?: string; onDone?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const err = nicknameError(value);
      if (err) return setError(err);
      const r = await setNickname(value);
      if (r.error) return setError(r.error);
      setError(undefined);
      onDone?.();
      router.refresh();
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">{current ? "닉네임 바꾸기" : "소통방에서 쓸 닉네임"}</span>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={12}
            placeholder="2~12자 (한글·영문·숫자)"
            aria-label="닉네임"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-brand"
          />
          <button disabled={pending} className="shrink-0 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-50">
            {pending ? "저장 중" : current ? "바꾸기" : "정하기"}
          </button>
        </div>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-zinc-500">다른 학생에게는 닉네임만 보여요. 단, 부적절한 글 관리를 위해 학생회(관리자)는 실제 회원을 확인할 수 있어요.</p>
    </form>
  );
}
