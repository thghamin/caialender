// 공식당(공학관 학생식당) 주간 메뉴: 경북대 생협 홈페이지 표를 읽어 요일·식사별로 정리 (순수 함수, 테스트 대상)

export const COOP_MENU_URL = "https://coop.knu.ac.kr/sub03/sub01_01.html?shop_sqno=86";

export type MenuItem = { name: string; price: string | null; note: string | null };
export type MenuDay = { label: string; date: string | null };
export type MenuMeal = { meal: string; corners: { corner: string; days: MenuItem[][] }[] };
export type WeeklyMenu = { days: MenuDay[]; meals: MenuMeal[] };

const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

/** 메뉴 한 줄: "최루탄라면&밥★<br/> 운영시간<br/> 10:00~14:30분<p></p><p>￦ 4,000</p>" → 이름·가격·안내 */
function parseItem(li: string): MenuItem | null {
  const price = li.match(/<p>\s*(￦\s*[\d,]+)\s*<\/p>/)?.[1].replace(/\s+/g, " ") ?? null;
  const text = clean(li.replace(/<p>[\s\S]*?<\/p>/g, ""))
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!text.length) return null;
  const [name, ...rest] = text;
  return { name, price, note: rest.length ? rest.join(" ") : null };
}

export function parseCoopMenu(html: string): WeeklyMenu {
  // 머리줄: 월(10/26) … 토(10/31)
  const head = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? "";
  const days: MenuDay[] = [...head.matchAll(/<th[^>]*>\s*([월화수목금토일])\s*<p[^>]*>\s*\(([^)]*)\)/g)].map((m) => ({ label: m[1], date: m[2].trim() || null }));

  const meals: MenuMeal[] = [];
  for (const m of html.matchAll(/<div class="week_table[^"]*">\s*<p class="title">([^<]*)<\/p>([\s\S]*?)<\/table>/g)) {
    const corners: MenuMeal["corners"] = [];
    for (const row of m[2].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
      if (!cells.length) continue;
      const corner = cells.map((c) => clean(c.match(/<div class="button_m[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? "").trim()).find(Boolean) ?? "메뉴";
      const perDay = cells.map((c) => [...c.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((li) => parseItem(li[1])).filter((x): x is MenuItem => !!x));
      // 요일 수에 맞춘다 (비어 있는 요일은 빈 목록)
      while (perDay.length < days.length) perDay.push([]);
      corners.push({ corner, days: perDay.slice(0, Math.max(days.length, perDay.length)) });
    }
    if (corners.length) meals.push({ meal: m[1].trim(), corners });
  }
  return { days, meals };
}

/** 오늘(KST) 요일이 메뉴표의 몇 번째 칸인지 (없으면 0: 주말 등) */
export function todayIndex(days: MenuDay[], now = Date.now()): number {
  const label = "일월화수목금토"[new Date(now + 9 * 3600_000).getUTCDay()];
  const i = days.findIndex((d) => d.label === label);
  return i >= 0 ? i : 0;
}
