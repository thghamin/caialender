"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nicknameError } from "@/lib/chat";
import { checkNickname, setNickname } from "./actions";

type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string };

/** 소통방 닉네임 정하기·바꾸기. 입력하는 동안 쓸 수 있는 닉네임인지 바로 알려 준다 */
export function NicknameForm({ current, onDone }: { current?: string; onDone?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const trimmed = value.trim();
  const unchanged = !!current && trimmed === current;

  // 입력이 멈추면(0.35초) 서버에 겹치는지 확인. 형식 오류는 바로 보여 준다
  useEffect(() => {
    if (!trimmed || unchanged) return;
    const formatError = nicknameError(trimmed);
    let alive = true;
    const t = setTimeout(
      async () => {
        if (formatError) return alive && setCheck({ state: "bad", message: formatError });
        setCheck({ state: "checking" });
        const r = await checkNickname(trimmed);
        if (alive) setCheck({ state: r.ok ? "ok" : "bad", message: r.message });
      },
      formatError ? 0 : 350,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [trimmed, unchanged]);

  const shown: Check = !trimmed || unchanged ? { state: "idle" } : check;
  const submit = () =>
    start(async () => {
      if (shown.state !== "ok") return;
      const r = await setNickname(trimmed);
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
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{current ? "닉네임 바꾸기" : "소통방에서 쓸 닉네임"}</span>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
            maxLength={12}
            placeholder="2~12자 (한글·영문·숫자)"
            aria-label="닉네임"
            aria-describedby="nickname-check"
            className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-[16px] outline-none ${
              shown.state === "ok" ? "border-emerald-500" : shown.state === "bad" ? "border-red-400" : "border-zinc-300 focus:border-brand"
            }`}
          />
          <button
            disabled={pending || shown.state !== "ok"}
            className="shrink-0 whitespace-nowrap rounded-xl bg-brand px-4 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {pending ? "저장 중" : current ? "바꾸기" : "정하기"}
          </button>
        </div>
      </label>
      <p id="nickname-check" aria-live="polite" className="min-h-[18px] text-[12.5px]">
        {shown.state === "checking" && <span className="text-zinc-400">확인 중…</span>}
        {shown.state === "ok" && <span className="font-semibold text-emerald-600">✓ {shown.message}</span>}
        {shown.state === "bad" && <span className="font-semibold text-red-600">✕ {shown.message}</span>}
      </p>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <p className="text-[12px] leading-relaxed text-zinc-500">
        다른 학생에게는 닉네임만 보여요. 단, 부적절한 글 관리를 위해 학생회(관리자)는 실제 회원을 확인할 수 있어요.
      </p>
    </form>
  );
}
