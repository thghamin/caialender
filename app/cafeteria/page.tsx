import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { COOP_MENU_URL, parseCoopMenu, type WeeklyMenu } from "@/lib/cafeteria";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui";
import { MenuView } from "./menu-view";

export const metadata: Metadata = { title: "공식당 메뉴 — C:AI:ender" };

/** 생협 홈페이지에서 주간 메뉴를 읽는다 (1시간 동안은 저장해 둔 것을 써서 빠르게) */
async function loadMenu(): Promise<WeeklyMenu | null> {
  try {
    const res = await fetch(COOP_MENU_URL, { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0 (C:AI:ender)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const menu = parseCoopMenu(await res.text());
    return menu.days.length && menu.meals.length ? menu : null;
  } catch {
    return null;
  }
}

export default async function CafeteriaPage() {
  await requireUser();
  const menu = await loadMenu();
  return (
    <div className="flex flex-col gap-4">
      <PageHero
        tone="custom"
        badge="공학관 학생식당"
        title="공식당 메뉴"
        subtitle={
          <>
            이번 주 중식·석식 메뉴와 가격이에요. 요일을 눌러 보세요.{" "}
            <a href={COOP_MENU_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
              출처: 경북대 생활협동조합
            </a>
          </>
        }
      />
      {menu ? (
        <MenuView menu={menu} />
      ) : (
        <Card className="text-center text-[14px] text-zinc-600">
          지금은 생협 홈페이지에서 메뉴를 불러오지 못했어요.{" "}
          <a href={COOP_MENU_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
            생협 홈페이지에서 보기
          </a>
        </Card>
      )}
    </div>
  );
}
