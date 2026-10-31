import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { COOP_MENU_URL, coopWeekUrl, parseCoopMenu, weekMonday, weekRange, type WeeklyMenu } from "@/lib/cafeteria";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { MenuView } from "./menu-view";

export const metadata: Metadata = { title: "공식당 메뉴 — C:AI:ender" };

/** 생협 홈페이지에서 주간 메뉴를 읽는다 (1시간 동안은 저장해 둔 것을 써서 빠르게) */
async function loadMenu(week: number): Promise<WeeklyMenu | null> {
  try {
    // 지난주는 바뀌지 않으므로 하루, 이번 주·다음 주는 1시간 동안 저장해 둔 것을 쓴다
    const res = await fetch(coopWeekUrl(week), { next: { revalidate: week < 0 ? 86400 : 3600 }, headers: { "User-Agent": "Mozilla/5.0 (C:AI:ender)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const menu = parseCoopMenu(await res.text());
    return menu.days.length ? menu : null;
  } catch {
    return null;
  }
}

export default async function CafeteriaPage({ searchParams }: PageProps<"/cafeteria">) {
  await requireUser();
  const sp = await searchParams;
  const { min, max } = weekRange();
  // ?w=-3 (3주 전) … ?w=1 (다음 주). 예전 주소 ?week=next 도 다음 주로
  const raw = sp.week === "next" ? 1 : Number(sp.w ?? 0);
  const week = Number.isFinite(raw) ? Math.min(max, Math.max(min, Math.trunc(raw))) : 0;
  const menu = await loadMenu(week);
  const monday = weekMonday(week);
  const md = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const label = `${md(monday)} ~ ${md(new Date(monday.getTime() + 5 * 86400_000))}`;
  const href = (w: number) => (w === 0 ? "/cafeteria" : `/cafeteria?w=${w}`);
  return (
    <div className="flex flex-col gap-4">
      <PageHero
        tone="custom"
        badge="공학관 학생식당"
        title="공식당 메뉴"
        subtitle={
          <>
            올해 첫 주부터 다음 주까지 중식·석식 메뉴와 가격이에요. 화살표로 주를, 요일을 눌러 날을 바꿔요.{" "}
            <a href={COOP_MENU_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
              출처: 경북대 생활협동조합
            </a>
          </>
        }
      />
      {/* 주 넘기기: 올해 첫 주 ~ 다음 주 */}
      <nav className="flex items-center gap-2" aria-label="주 선택">
        {week > min ? (
          <Link href={href(week - 1)} prefetch aria-label="이전 주" className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-zinc-600 ring-1 ring-zinc-200">
            ‹
          </Link>
        ) : (
          <span className="size-10 shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="text-[16px] font-extrabold tabular-nums" data-testid="week-label">
            {label}
          </span>
          <span className="text-[12px] font-semibold text-brand">{week === 0 ? "이번 주" : week === 1 ? "다음 주" : week === -1 ? "지난주" : `${-week}주 전`}</span>
        </div>
        {week < max ? (
          <Link href={href(week + 1)} prefetch aria-label="다음 주" className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-zinc-600 ring-1 ring-zinc-200">
            ›
          </Link>
        ) : (
          <span className="size-10 shrink-0" />
        )}
      </nav>
      <p className="-mt-1 rounded-xl bg-brand-soft px-3 py-2 text-center text-[12.5px] font-medium text-brand" data-testid="menu-update-note">
        🔄 메뉴는 계속 업데이트돼요. 생협 홈페이지에 새 메뉴가 올라오면 1시간 안에 여기도 바뀌어요.
      </p>
      {week !== 0 && (
        <Link href="/cafeteria" className="-mt-2 self-center text-[12.5px] font-semibold text-zinc-500 underline underline-offset-2">
          이번 주로 돌아가기
        </Link>
      )}
      {menu ? (
        <MenuView key={week} menu={menu} thisWeek={week === 0} />
      ) : (
        <Card className="text-center text-[14px] text-zinc-600">
          {week > 0 ? "다음 주 메뉴가 아직 올라오지 않았거나, " : "지금은 "}생협 홈페이지에서 메뉴를 불러오지 못했어요. 올라오는 대로 업데이트돼요.{" "}
          <a href={coopWeekUrl(week)} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
            생협 홈페이지에서 보기
          </a>
        </Card>
      )}
    </div>
  );
}
