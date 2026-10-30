"use client";

import { useActionState } from "react";
import { createNotice } from "@/app/admin/actions";
import { Alert, Button, Field } from "@/components/ui";
import { PosterPicker } from "./file-picker";

export function NoticeForm({ now }: { now: string }) {
  const [state, action, pending] = useActionState(createNotice, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="공지 제목" name="title" required maxLength={200} placeholder="예: 2027 새내기 배움터 안내" />
      <Field label="공지방 게시 시각" name="posted_at" type="datetime-local" defaultValue={now} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">공지 본문 (카톡 공지를 그대로 붙여넣기)</span>
        <textarea
          name="body"
          rows={12}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-[0.8125rem] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <PosterPicker />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <Button disabled={pending}>{pending ? "업로드 중…" : "등록하고 AI 분석 시작"}</Button>
      <p className="text-xs text-zinc-500">
        등록 즉시 저장되고 AI 분석은 백그라운드에서 진행됩니다. 추출된 일정은 &lsquo;검수 대기&rsquo; 상태로 저장되며, 확인 후 게시해야 학생들에게 보입니다.
      </p>
    </form>
  );
}
