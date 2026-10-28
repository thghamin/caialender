"use client";

import { useTransition } from "react";
import { resolveChange } from "./actions";

export function ChangeActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => start(() => resolveChange(id, true))}
        className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
      >
        반영
      </button>
      <button
        disabled={pending}
        onClick={() => start(() => resolveChange(id, false))}
        className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
      >
        무시
      </button>
    </span>
  );
}
