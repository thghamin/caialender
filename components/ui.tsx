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

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-brand/15 bg-white/95 p-5 shadow-sm shadow-brand/10 ${className}`}
    />
  );
}
