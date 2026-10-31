import { Hobanu } from "@/components/hobanu";

/** 페이지 이동 중 바로 보이는 화면. 서버 응답을 기다리는 동안 빈 화면 대신 보여준다 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <div className="relative h-36 overflow-hidden rounded-[24px] bg-gradient-to-br from-brand-soft via-white to-brand-soft ring-1 ring-brand/15">
        <Hobanu className="absolute right-6 top-1/2 size-20 -translate-y-1/2 animate-bounce opacity-80" title="" />
        <div className="absolute left-6 top-6 h-5 w-28 animate-pulse rounded-full bg-brand/15" />
        <div className="absolute left-6 top-14 h-8 w-40 animate-pulse rounded-lg bg-zinc-200/80" />
        <div className="absolute left-6 top-[100px] h-3.5 w-56 max-w-[55%] animate-pulse rounded bg-zinc-200/60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="h-[520px] animate-pulse rounded-2xl border border-brand/15 bg-white/80" />
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-2xl border border-brand/15 bg-white/80" />
          <div className="h-56 animate-pulse rounded-2xl border border-brand/15 bg-white/80" />
        </div>
      </div>
    </div>
  );
}
