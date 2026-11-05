import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/provider";
import { buildBriefingPrompt } from "@/lib/ai/prompts";
import { formatKst, kstDate, requestNow } from "@/lib/datetime";
import type { CalendarEvent } from "@/lib/types";

const DAY = 86400_000;
const PROMPT_VERSION = 4;

/** KST 기준 이번 주 월요일 0시 ~ 다음 주 월요일 0시 */
export function weekRange(now = requestNow()) {
  const kstNow = new Date(now + 9 * 3600_000);
  const dow = (kstNow.getUTCDay() + 6) % 7; // 월=0
  const mondayKst = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - dow * DAY;
  const start = mondayKst - 9 * 3600_000;
  return { start, end: start + 7 * DAY, weekStart: new Date(mondayKst).toISOString().slice(0, 10) };
}

/** 이번 주 일정 + 앞으로 2주 안의 마감 */
export function selectBriefingEvents(events: CalendarEvent[], now = requestNow()) {
  const { start, end } = weekRange(now);
  return events.filter((e) => {
    const s = new Date(e.start_at).getTime();
    const f = new Date(e.end_at ?? e.start_at).getTime();
    const inWeek = s < end && f >= start;
    const soonDeadline = e.kind === "deadline" && s >= now && s < now + 14 * DAY;
    return inWeek || soonDeadline;
  });
}

/** 일정이 끝났는지 (종일 일정은 그날 밤 자정까지) */
function endedAt(e: CalendarEvent) {
  return new Date(e.end_at ?? e.start_at).getTime() + (e.all_day ? DAY : 0);
}

export type BriefingItem = {
  id: string;
  title: string;
  /** 화면에 굵게 보일 날짜·시각 (코드가 만든 정확한 값) */
  when: string;
  location: string | null;
  kind: CalendarEvent["kind"];
  /** 지금 진행 중인지 */
  ongoing: boolean;
};

/** 브리핑 목록: 이번 주 일정 + 2주 안 마감 중 아직 끝나지 않은 것만, 시작 순서대로 */
export function briefingItems(events: CalendarEvent[], now = requestNow()): BriefingItem[] {
  return selectBriefingEvents(events, now)
    .filter((e) => endedAt(e) > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .map((e) => ({
      id: e.id,
      title: e.title,
      when: e.end_at && kstDate(e.end_at) !== kstDate(e.start_at)
        ? `${formatKst(e.start_at, !e.all_day)} ~ ${formatKst(e.end_at, !e.all_day)}`
        : e.end_at && !e.all_day
          ? `${formatKst(e.start_at)} ~ ${formatKst(e.end_at).split(" ").pop()}`
          : formatKst(e.start_at, !e.all_day),
      location: e.location,
      kind: e.kind,
      ongoing: new Date(e.start_at).getTime() <= now,
    }));
}

/** AI 요약에 날짜·시각이 섞이면 버린다 (목록과 어긋나는 숫자를 보여 주지 않기 위해) */
export function cleanSummary(text: string) {
  const t = text.replace(/\*\*/g, "").replace(/^\s*[•\-]\s*/gm, "").trim();
  if (!t || /\d{1,2}:\d{2}|\d+\s*월\s*\d+\s*일|\d+\s*시\b|오전|오후/.test(t)) return null;
  return t;
}

export type Briefing = { summary: string; items: BriefingItem[]; createdAt: string; model: string | null; cached: boolean };

/**
 * 주간 브리핑. 일정 목록(날짜·시각)은 요청마다 코드가 정확히 만들고, AI는 흐름 요약 1~2문장만 쓴다.
 * 요약은 DB에 캐시하고 남은 일정이 바뀌거나(지난 일정이 빠지는 것 포함) 날짜가 바뀌면 새로 만든다.
 * AI 실패 시에도 목록은 보여 준다.
 */
export async function getBriefing(opts: { userId: string | null; scopeLabel: string; events: CalendarEvent[] }): Promise<Briefing> {
  const now = requestNow();
  const { weekStart } = weekRange(now);
  const items = briefingItems(opts.events, now);
  const remaining = opts.events.filter((e) => items.some((i) => i.id === e.id));
  if (!items.length) {
    return { summary: "이번 주에는 남은 일정이 없어요.", items, createdAt: new Date(now).toISOString(), model: null, cached: false };
  }
  const hash = createHash("sha256")
    .update(JSON.stringify([PROMPT_VERSION, kstDate(new Date(now).toISOString()), remaining.map((e) => [e.id, e.updated_at])]))
    .digest("hex")
    .slice(0, 32);

  const db = createServiceClient();
  let query = db.from("briefings").select("content, created_at, model, source_hash").eq("week_start", weekStart);
  query = opts.userId ? query.eq("user_id", opts.userId) : query.is("user_id", null);
  const { data: cached } = await query.maybeSingle();
  if (cached && cached.source_hash === hash) {
    return { summary: cached.content, items, createdAt: cached.created_at, model: cached.model, cached: true };
  }

  const fallback = `이번 주 남은 일정은 ${items.length}개예요. 아래에서 날짜를 확인하고 필요한 일정은 내 캘린더에 담아 두세요.`;
  let summary = fallback;
  let model: string | null = null;
  try {
    const r = await generateText({
      messages: [
        {
          role: "user",
          content: buildBriefingPrompt({ now: new Date(now).toISOString(), weekLabel: `이번 주(${weekStart} 주간)`, scope: opts.scopeLabel, events: remaining }),
        },
      ],
      maxTokens: 300,
      timeoutMs: 45_000,
    });
    summary = cleanSummary(r.text) ?? fallback;
    model = r.model;
  } catch (e) {
    console.error("[briefing] AI 요약 실패, 목록만 보여 준다:", e);
    return { summary: fallback, items, createdAt: new Date(now).toISOString(), model: null, cached: false };
  }

  const row = { user_id: opts.userId, week_start: weekStart, content: summary, source_hash: hash, model };
  if (cached) {
    let upd = db.from("briefings").update({ ...row, created_at: new Date().toISOString() }).eq("week_start", weekStart);
    upd = opts.userId ? upd.eq("user_id", opts.userId) : upd.is("user_id", null);
    await upd;
  } else {
    await db.from("briefings").insert(row);
  }
  return { summary, items, createdAt: new Date().toISOString(), model, cached: false };
}
