"use client";

import { useTransition } from "react";
import { deletePersonalEvent } from "./actions";

export function DeletePersonalButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => deletePersonalEvent(id))}
      className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
