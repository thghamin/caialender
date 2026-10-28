"use client";

import { useActionState, useRef } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";

export function PersonalEventForm() {
  const [state, action, pending] = useActionState(addPersonalEvent, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      key={state?.savedAt ?? "form"}
      className="flex flex-col gap-3"
    >
      <Field label="제목" name="title" required maxLength={100} placeholder="예: 알바, 동아리 회의" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작" name="start" type="datetime-local" required />
        <Field label="종료" name="end" type="datetime-local" required />
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.savedAt && <Alert kind="info">개인 일정을 추가했습니다.</Alert>}
      {state?.conflicts && (
        <div className="flex flex-col gap-2">
          <Alert kind="error">
            다음 일정과 시간이 겹칩니다: {state.conflicts.map((c) => `${c.title}(${formatKst(c.start_at)})`).join(", ")}
          </Alert>
          <Button
            type="button"
            className="bg-red-600"
            disabled={pending}
            onClick={() => {
              const fd = new FormData(formRef.current!);
              fd.set("force", "1");
              action(fd);
            }}
          >
            겹쳐도 추가하기
          </Button>
        </div>
      )}
      <Button disabled={pending}>{pending ? "확인 중…" : "추가"}</Button>
    </form>
  );
}
