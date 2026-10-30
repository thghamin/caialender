import type { ComponentProps } from "react";

export function Field({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        {...props}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-dark disabled:opacity-50 ${className}`}
    />
  );
}

export function Alert({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  const style = kind === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200";
  return <p className={`rounded-lg border px-3 py-2 text-sm ${style}`}>{children}</p>;
}

/** 카드 제목: 색 타일 아이콘 + 굵은 제목 (라이벌 서비스보다 정돈된 앱 느낌) */
export function CardTitle({ icon, children, right }: { icon: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-base" aria-hidden>
        {icon}
      </span>
      <h2 className="flex-1 text-[1.05rem] font-bold">{children}</h2>
      {right}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`rounded-[22px] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-12px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.04] ${className}`}
    />
  );
}
