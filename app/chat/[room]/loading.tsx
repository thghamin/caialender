/** 방에 들어가는 동안: 큰 배너 대신 대화 화면 모양으로 바로 보여 준다 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="대화 불러오는 중">
      <div className="flex items-center gap-2">
        <div className="size-9" />
        <div className="h-6 w-32 animate-pulse rounded-lg bg-zinc-200/80" />
        <div className="ml-auto flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="size-8 animate-pulse rounded-full bg-white ring-1 ring-zinc-200" />
          ))}
        </div>
      </div>
      <div className="h-5 w-56 animate-pulse rounded bg-zinc-200/60" />
      <div className="flex h-[calc(100dvh-268px-env(safe-area-inset-bottom))] min-h-[380px] flex-col justify-end gap-3 overflow-hidden rounded-[22px] bg-white p-3 ring-1 ring-black/[0.04] md:h-[calc(100dvh-190px)]">
        {[["w-40", false], ["w-56", true], ["w-32", false], ["w-48", true], ["w-44", false]].map(([w, mine], i) => (
          <div key={i} className={`h-9 ${w} animate-pulse rounded-2xl ${mine ? "self-end bg-brand/15" : "self-start bg-zinc-100"}`} />
        ))}
        <div className="mt-1 h-11 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}
