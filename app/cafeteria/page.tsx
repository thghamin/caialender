import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { COOP_MENU_URL, coopWeekUrl, parseCoopMenu, type WeeklyMenu } from "@/lib/cafeteria";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { MenuView } from "./menu-view";

export const metadata: Metadata = { title: "공식당 메뉴 — C:AI:ender" };

/** 생협 홈페이지에서 주간 메뉴를 읽는다 (1시간 동안은 저장해 둔 것을 써서 빠르게) */
async function loadMenu(week: number): Promise<WeeklyMenu | null> {
  try {
    const res = await fetch(coopWeekUrl(week), { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0 (C:AI:ender)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const menu = parseCoopMenu(await res.text());
    return menu.days.length && menu.meals.length ? menu : null;
  } catch {
    return null;
  }
}

export default async function CafeteriaPage({ searchParams }: PageProps<"/cafeteria">) {
  await requireUser();
  const week = (await searchParams).week === "next" ? 1 : 0;
  const menu = await loadMenu(week);
  return (
    <div className="flex flex-col gap-4">
      <PageHero
        tone="custom"
        badge="공학관 학생식당"
        title="공식당 메뉴"
        subtitle={
          <>
            이번 주·다음 주 중식·석식 메뉴와 가격이에요. 요일을 눌러 보세요.{" "}
            <a href={COOP_MENU_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
              출처: 경북대 생활협동조합
            </a>
          </>
        }
      />
      {/* 이번 주 / 다음 주 */}
      <div className="flex w-fit gap-1 rounded-full bg-white p-1 ring-1 ring-zinc-200" role="tablist" aria-label="주">
        {[
          ["이번 주", "/cafeteria"],
          ["다음 주", "/cafeteria?week=next"],
        ].map(([label, href], i) => (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={week === i}
            prefetch
            className={`rounded-full px-4 py-1.5 text-[14px] font-bold ${week === i ? "bg-brand text-white" : "text-zinc-500"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {menu ? (
        <MenuView key={week} menu={menu} thisWeek={week === 0} />
      ) : (
        <Card className="text-center text-[14px] text-zinc-600">
          {week ? "다음 주 메뉴가 아직 올라오지 않았거나, " : "지금은 "}생협 홈페이지에서 메뉴를 불러오지 못했어요.{" "}
          <a href={coopWeekUrl(week)} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
            생협 홈페이지에서 보기
          </a>
        </Card>
      )}
    </div>
  );
}
