/** 소통방 목록을 여는 동안 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="소통방 불러오는 중">
      <div className="h-28 animate-pulse rounded-2xl bg-gradient-to-br from-brand/70 to-brand-dark/70" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-black/[0.04]">
            <div className="size-12 animate-pulse rounded-2xl bg-brand-soft" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-44 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
