"use client";

import { startTransition, useActionState } from "react";
import { addPersonalEvent } from "./actions";
import { Alert, Button, Field } from "@/components/ui";
import { formatKst } from "@/lib/datetime";

export function PersonalEventForm() {
  const [state, action, pending] = useActionState(addPersonalEvent, undefined);
  const values = state?.values;

  return (
    // 응답마다 다시 마운트해서 서버가 돌려준 입력값을 채운다
    <form action={action} key={JSON.stringify(state ?? {})} className="flex flex-col gap-3">
      <Field label="제목" name="title" required maxLength={100} placeholder="예: 알바, 동아리 회의" defaultValue={values?.title} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작" name="start" type="datetime-local" required defaultValue={values?.start} />
        <Field label="종료" name="end" type="datetime-local" required defaultValue={values?.end} />
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.savedAt && <Alert kind="info">개인 일정을 추가했습니다.</Alert>}
      {state?.conflicts && values && (
        <div className="flex flex-col gap-2">
          <Alert kind="error">
            다음 일정과 시간이 겹칩니다: {state.conflicts.map((c) => `${c.title}(${formatKst(c.start_at)})`).join(", ")}
          </Alert>
          <Button
            type="button"
            className="bg-red-600"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              for (const [k, v] of Object.entries(values)) fd.set(k, v);
              fd.set("force", "1");
              startTransition(() => action(fd));
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
