import { Hobanu } from "./hobanu";

/** 페이지 상단 빨강 배너. 호반우가 오른쪽에서 인사한다 */
export function PageHero({ title, subtitle, badge, children }: {
  title: string;
  subtitle: React.ReactNode;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#c81a22] to-brand-dark px-6 py-6 text-white shadow-lg shadow-red-200/60 sm:px-8">
      {/* 장식: 흰 원과 KNU 금색 띠 */}
      <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-40 -bottom-24 size-48 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-knu-gold/80" />
      <Hobanu className="pointer-events-none absolute -bottom-3 right-4 hidden size-36 drop-shadow-xl sm:block" title="" />
      <div className="relative flex flex-col gap-2 sm:pr-40">
        {badge && (
          <span className="w-fit rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-white/30">
            {badge}
          </span>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-red-50/90">{subtitle}</p>
        {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}
