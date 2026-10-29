import { Hobanu } from "./hobanu";

export type HeroTone = "knu" | "dept" | "custom";

// knu: 경북대 빨강, dept: 학과(전자공학부) 초록, custom: 내 캘린더 사용자 지정 색 (--my-main / --my-dark)
const GRADIENT: Record<HeroTone, string> = {
  knu: "linear-gradient(135deg, #da2128, #c81a22 50%, #a8141b)",
  dept: "linear-gradient(135deg, #16a34a, #15803d 50%, #14532d)",
  custom: "linear-gradient(135deg, var(--my-main), var(--my-dark))",
};

/** 페이지 상단 배너. 학과 캘린더는 초록 + K:AI + 전자공학 로고, 나머지는 호반우 */
export function PageHero({ title, subtitle, badge, tone = "knu", children }: {
  title: string;
  subtitle: React.ReactNode;
  badge?: string;
  tone?: HeroTone;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl px-6 py-6 text-white shadow-lg shadow-zinc-300/60 transition-[background] duration-300 sm:px-8"
      style={{ background: GRADIENT[tone] }}
    >
      {/* 장식: 흰 원과 아래 띠 */}
      <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-40 -bottom-24 size-48 rounded-full bg-white/5" />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-1 ${tone === "dept" ? "bg-lime-300/70" : "bg-knu-gold/80"}`} />
      {tone === "dept" ? (
        <>
          <span className="pointer-events-none absolute -bottom-6 left-1/3 select-none text-[120px] font-black leading-none tracking-tighter text-white/10 sm:text-[150px]">
            K:AI
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 정적 로고, 최적화 불필요 */}
          <img
            src="/ee-logo-white.png"
            alt="경북대학교 전자공학부 로고"
            width={512}
            height={474}
            className="pointer-events-none absolute bottom-4 right-6 hidden h-28 w-auto opacity-95 drop-shadow-lg sm:block"
          />
        </>
      ) : (
        <Hobanu className="pointer-events-none absolute -bottom-3 right-4 hidden size-36 drop-shadow-xl sm:block" title="" />
      )}
      <div className="relative flex flex-col gap-2 sm:pr-40">
        {badge && (
          <span className="w-fit rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-white/30">
            {badge}
          </span>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-white/85">{subtitle}</p>
        {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}
