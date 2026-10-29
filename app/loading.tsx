import { Hobanu } from "@/components/hobanu";

/** 페이지 이동 중 바로 보이는 화면. 서버 응답을 기다리는 동안 빈 화면 대신 보여준다 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <div className="relative h-32 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark shadow-lg shadow-brand/20">
        <Hobanu className="absolute -bottom-3 right-4 hidden size-28 animate-bounce sm:block" title="" />
        <div className="absolute left-8 top-8 h-8 w-48 animate-pulse rounded-lg bg-white/25" />
        <div className="absolute left-8 top-20 h-4 w-80 max-w-[60%] animate-pulse rounded bg-white/20" />
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
