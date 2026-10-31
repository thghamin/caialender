// 페이지 상단 카드: 연한 파스텔 색 + 오른쪽 그림(달력·말풍선). 제목은 마지막 단어만 색으로 강조
// 학과(초록)·학사(빨강)·질문(보라)은 고정색, 내 캘린더·시간표·소통방은 사용자가 고른 색(--brand)의 연한 버전
export type HeroTone = "knu" | "dept" | "my" | "chat" | "timetable" | "qna" | "custom";

type Art = "check" | "star" | "chat" | "question";
const TONES: Record<HeroTone, { card: string; badge: string; accent: string; main: string; soft: string; deep: string; art: Art; bell?: boolean; watermark?: string }> = {
  knu: {
    card: "from-rose-50 via-white to-red-100/70 ring-red-200/60",
    badge: "bg-red-100/80 text-red-600 ring-red-200/80",
    accent: "text-red-500",
    main: "#ef5159",
    soft: "#fde4e5",
    deep: "#d23b43",
    art: "check",
    watermark: "KNU",
  },
  dept: {
    card: "from-emerald-50 via-white to-green-100/70 ring-green-200/60",
    badge: "bg-green-100/80 text-green-700 ring-green-200/80",
    accent: "text-green-700",
    main: "#35a865",
    soft: "#dcf2e4",
    deep: "#1f7f48",
    art: "check",
    bell: true,
    watermark: "K:AI",
  },
  my: {
    card: "from-[color-mix(in_srgb,var(--brand)_9%,white)] via-white to-[color-mix(in_srgb,var(--brand)_17%,white)] ring-[color-mix(in_srgb,var(--brand)_22%,white)]",
    badge: "bg-[color-mix(in_srgb,var(--brand)_13%,white)] text-brand ring-[color-mix(in_srgb,var(--brand)_25%,white)]",
    accent: "text-brand",
    main: "var(--brand)",
    soft: "color-mix(in srgb, var(--brand) 16%, white)",
    deep: "var(--brand-dark)",
    art: "star",
  },
  timetable: {
    card: "from-[color-mix(in_srgb,var(--brand)_9%,white)] via-white to-[color-mix(in_srgb,var(--brand)_17%,white)] ring-[color-mix(in_srgb,var(--brand)_22%,white)]",
    badge: "bg-[color-mix(in_srgb,var(--brand)_13%,white)] text-brand ring-[color-mix(in_srgb,var(--brand)_25%,white)]",
    accent: "text-brand",
    main: "var(--brand)",
    soft: "color-mix(in srgb, var(--brand) 16%, white)",
    deep: "var(--brand-dark)",
    art: "check",
    bell: true,
  },
  chat: {
    card: "from-[color-mix(in_srgb,var(--brand)_9%,white)] via-white to-[color-mix(in_srgb,var(--brand)_17%,white)] ring-[color-mix(in_srgb,var(--brand)_22%,white)]",
    badge: "bg-[color-mix(in_srgb,var(--brand)_13%,white)] text-brand ring-[color-mix(in_srgb,var(--brand)_25%,white)]",
    accent: "text-brand",
    main: "var(--brand)",
    soft: "color-mix(in srgb, var(--brand) 16%, white)",
    deep: "var(--brand-dark)",
    art: "chat",
  },
  qna: {
    card: "from-violet-50 via-white to-purple-100/70 ring-violet-200/60",
    badge: "bg-violet-100/80 text-violet-700 ring-violet-200/80",
    accent: "text-violet-600",
    main: "#8b5cf6",
    soft: "#ede4fe",
    deep: "#7039e0",
    art: "question",
  },
  custom: {
    card: "from-brand-soft via-white to-brand-soft ring-brand/20",
    badge: "bg-brand-soft text-brand ring-brand/25",
    accent: "text-brand",
    main: "var(--brand)",
    soft: "color-mix(in srgb, var(--brand) 15%, white)",
    deep: "var(--brand-dark)",
    art: "check",
  },
};

/** 반짝이 (4갈래 별) */
function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return <path d={`M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`} fill={color} />;
}

/** 오른쪽 그림: 고리 달린 달력(체크·별) 또는 말풍선, 필요하면 알림 종 */
function HeroArt({ tone }: { tone: HeroTone }) {
  const t = TONES[tone];
  return (
    <svg viewBox="0 0 160 140" className="h-full w-full" aria-hidden>
      <defs>
        <filter id={`hero-shadow-${tone}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" style={{ floodColor: t.deep, floodOpacity: 0.22 }} />
        </filter>
      </defs>
      {/* 움직임 선 */}
      <path d="M20 46l10 6M16 64h12M24 30l7 9" stroke={t.main} strokeWidth="4" strokeLinecap="round" opacity="0.75" />
      {t.art === "chat" || t.art === "question" ? (
        <g filter={`url(#hero-shadow-${tone})`}>
          {/* 뒤 말풍선 (흰색) */}
          <path d="M70 70h56a16 16 0 0 1 16 16v20a16 16 0 0 1-16 16h-8l2 12-14-12H70a16 16 0 0 1-16-16V86a16 16 0 0 1 16-16z" fill="#fff" />
          {/* 앞 말풍선 (색) */}
          <path d="M44 24h60a18 18 0 0 1 18 18v22a18 18 0 0 1-18 18H62l-16 13 3-13h-5a18 18 0 0 1-18-18V42a18 18 0 0 1 18-18z" fill={t.main} />
          {t.art === "chat" ? (
            <g fill="#fff">
              <circle cx="56" cy="53" r="6" />
              <circle cx="74" cy="53" r="6" />
              <circle cx="92" cy="53" r="6" />
            </g>
          ) : (
            <text x="74" y="66" textAnchor="middle" fontSize="38" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">
              ?
            </text>
          )}
        </g>
      ) : (
        <g filter={`url(#hero-shadow-${tone})`}>
          {/* 달력 몸통 */}
          <rect x="38" y="30" width="86" height="92" rx="16" fill="#fff" />
          <path d="M38 46a16 16 0 0 1 16-16h54a16 16 0 0 1 16 16v8H38z" fill={t.main} />
          {/* 고리 */}
          <rect x="58" y="18" width="9" height="22" rx="4.5" fill={t.deep} />
          <rect x="95" y="18" width="9" height="22" rx="4.5" fill={t.deep} />
          {/* 칸 */}
          <g fill={t.soft}>
            {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => <rect key={`${c}-${r}`} x={48 + c * 18} y={64 + r * 18} width="13" height="13" rx="3.5" />))}
          </g>
          {/* 표시: 체크 또는 별 */}
          {t.art === "star" ? (
            <path d="M81 72l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L81 100.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill={t.main} />
          ) : (
            <>
              <rect x="84" y="82" width="22" height="22" rx="6" fill={t.main} />
              <path d="M89 93l4.5 4.5 8-9" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </g>
      )}
      {t.bell && (
        <g>
          <circle cx="136" cy="28" r="18" fill="#fff" stroke={t.soft} strokeWidth="2" />
          <path d="M127 34c2-2 2.6-4 2.6-8a6.4 6.4 0 0 1 12.8 0c0 4 .6 6 2.6 8z" fill={t.main} />
          <circle cx="136" cy="37.5" r="3" fill={t.deep} />
        </g>
      )}
      <Sparkle x={140} y={70} s={6} color="#fff" />
      <Sparkle x={148} y={108} s={4.5} color={t.main} />
      <Sparkle x={30} y={112} s={4} color={t.main} />
    </svg>
  );
}

/** 페이지 상단 카드. 휴대폰: 글 왼쪽 + 작은 그림 오른쪽 위 / PC: 넓은 카드 + 큰 그림 */
export function PageHero({ title, subtitle, badge, tone = "custom", children }: {
  title: string;
  subtitle: React.ReactNode;
  badge?: string;
  tone?: HeroTone;
  children?: React.ReactNode;
}) {
  const t = TONES[tone];
  const words = title.split(" ");
  const last = words.pop();
  return (
    <section
      className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br px-5 py-5 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.18)] ring-1 sm:px-8 sm:py-7 ${t.card}`}
    >
      {/* 장식: 부드러운 빛, 희미한 글자(K:AI·KNU) */}
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/60 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 size-56 rounded-full bg-white/50 blur-2xl" />
      {t.watermark && (
        <span className={`pointer-events-none absolute -bottom-5 right-24 select-none text-[96px] font-black leading-none tracking-tighter opacity-[0.07] sm:right-56 sm:text-[140px] ${t.accent}`}>
          {t.watermark}
        </span>
      )}
      <div className="pointer-events-none absolute right-1 top-2 h-[96px] w-[110px] sm:right-8 sm:top-1/2 sm:h-[150px] sm:w-[172px] sm:-translate-y-1/2">
        <HeroArt tone={tone} />
      </div>
      <div className="relative flex flex-col gap-2">
        {badge && (
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold ring-1 sm:text-xs ${t.badge}`}>
            {/* 학과 캘린더: 전자공학부 로고를 배지 앞에 작게 */}
            {tone === "dept" && (
              // eslint-disable-next-line @next/next/no-img-element -- 작은 정적 로고, 최적화 불필요
              <img src="/ee-logo.png" alt="경북대학교 전자공학부 로고" width={512} height={474} className="h-4 w-auto" />
            )}
            {badge}
          </span>
        )}
        <h1 className="pr-[104px] text-[27px] font-extrabold leading-tight tracking-tight text-zinc-900 sm:pr-48 sm:text-[34px]">
          {words.join(" ")} <span className={t.accent}>{last}</span>
        </h1>
        <p className="pr-2 text-[13px] leading-[1.6] text-zinc-600 sm:max-w-[60%] sm:pr-0 sm:text-[14.5px]">{subtitle}</p>
        {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}
