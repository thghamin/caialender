"use client";

import { useActionState } from "react";
import { importAcademicSchedule } from "./actions";

export function AcademicImportForm() {
  const [state, action, pending] = useActionState(importAcademicSchedule, undefined);
  const year = new Date().getFullYear();
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <select name="year" defaultValue={year} className="rounded-md border border-zinc-300 bg-white px-2 py-2">
        {[year - 1, year, year + 1].map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <button disabled={pending} className="rounded-md bg-zinc-800 px-4 py-2 font-medium text-white hover:bg-zinc-900 disabled:opacity-50">
        {pending ? "불러오는 중…" : "학사일정 불러오기"}
      </button>
      {state?.error && <span className="text-red-600">{state.error}</span>}
      {state?.message && <span className="text-emerald-700">{state.message}</span>}
    </form>
  );
}
