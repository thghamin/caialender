"use client";

import { useState } from "react";
import { todayIndex, type WeeklyMenu } from "@/lib/cafeteria";

/** 요일 고르기 + 그날 중식·석식 메뉴 (처음엔 오늘) */
export function MenuView({ menu, thisWeek }: { menu: WeeklyMenu; thisWeek: boolean }) {
  // 다음 주는 '오늘'이 없으므로 월요일(메뉴 있는 첫날)부터
  const today = thisWeek ? todayIndex(menu.days) : -1;
  // 오늘 메뉴가 없으면(주말·휴무) 메뉴가 있는 첫 요일을 먼저 보여 준다
  const hasMenu = (i: number) => menu.meals.some((m) => m.corners.some((c) => (c.days[i] ?? []).length > 0));
  const [day, setDay] = useState(() => (today >= 0 && hasMenu(today) ? today : Math.max(0, menu.days.findIndex((_, i) => hasMenu(i)))));
  // 방학·휴무 주: 메뉴가 하나도 없으면 안내만
  if (!menu.days.some((_, i) => hasMenu(i)))
    return <p className="rounded-[22px] bg-white p-6 text-center text-[14px] text-zinc-500 ring-1 ring-black/[0.04]">이 주에는 메뉴가 없어요. (방학·휴무, 또는 아직 안 올라옴 — 올라오는 대로 업데이트돼요)</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="요일">
        {menu.days.map((d, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === day}
            onClick={() => setDay(i)}
            className={`flex min-w-[54px] shrink-0 flex-col items-center rounded-2xl px-3 py-2 text-[14px] font-bold transition-colors ${
              i === day ? "bg-brand text-white shadow-sm" : "bg-white text-zinc-600 ring-1 ring-zinc-200"
            }`}
          >
            {d.label}
            <span className={`text-[11px] font-medium ${i === day ? "text-white/85" : "text-zinc-400"}`}>{i === today ? "오늘" : d.date}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {menu.meals.map((m) => (
          <section key={m.meal} className="rounded-[22px] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-12px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.04]">
            <h2 className="mb-2 flex items-center gap-2 text-[17px] font-extrabold">
              {m.meal === "석식" ? "🌙" : m.meal === "조식" ? "🌅" : "☀️"} {m.meal}
            </h2>
            {m.corners.map((c, ci) => {
              const items = c.days[day] ?? [];
              return (
                <div key={ci} className="mb-2 last:mb-0">
                  <span className="mb-1 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold text-brand">{c.corner}</span>
                  {items.length ? (
                    <ul className="divide-y divide-zinc-100">
                      {items.map((it, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 py-2 text-[14.5px]">
                          <span className="min-w-0">
                            {it.name}
                            {it.note && <span className="block text-[12px] text-zinc-400">{it.note}</span>}
                          </span>
                          {it.price && <span className="shrink-0 tabular-nums text-[13.5px] font-semibold text-zinc-500">{it.price}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-3 text-[13.5px] text-zinc-400">이날은 메뉴가 없어요.</p>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <p className="text-[12px] text-zinc-400">★ 표시는 돼지고기(돈육)가 들어간 메뉴예요. 메뉴는 식당 사정에 따라 바뀔 수 있어요.</p>
    </div>
  );
}
