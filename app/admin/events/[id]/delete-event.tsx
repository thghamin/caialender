"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/admin/actions";

export function DeleteEventButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("이 일정을 삭제할까요? 학생들의 관심 일정에서도 사라집니다.")) return;
        start(async () => {
          await deleteEvent(id);
          router.push("/admin");
        });
      }}
      className="self-start text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      일정 삭제
    </button>
  );
}
