import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/provider";
import { buildBriefingPrompt } from "@/lib/ai/prompts";
import { requestNow } from "@/lib/datetime";
import type { CalendarEvent } from "@/lib/types";

const DAY = 86400_000;
const PROMPT_VERSION = 3;

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

export type Briefing = { content: string; createdAt: string; model: string | null; cached: boolean };

/**
 * 주간 브리핑을 DB 캐시에서 가져오고, 없거나 일정이 바뀌었으면 AI로 새로 만든다.
 * AI 실패 시 예외를 던지며, 호출 측은 캘린더 기능과 무관하게 처리한다.
 */
export async function getBriefing(opts: { userId: string | null; scopeLabel: string; events: CalendarEvent[] }): Promise<Briefing> {
  const now = requestNow();
  const { weekStart } = weekRange(now);
  const selected = selectBriefingEvents(opts.events, now);
  const hash = createHash("sha256")
    .update(JSON.stringify([PROMPT_VERSION, selected.map((e) => [e.id, e.updated_at])]))
    .digest("hex")
    .slice(0, 32);

  const db = createServiceClient();
  let query = db.from("briefings").select("content, created_at, model, source_hash").eq("week_start", weekStart);
  query = opts.userId ? query.eq("user_id", opts.userId) : query.is("user_id", null);
  const { data: cached } = await query.maybeSingle();
  if (cached && cached.source_hash === hash) {
    return { content: cached.content, createdAt: cached.created_at, model: cached.model, cached: true };
  }

  const { text, model } = await generateText({
    messages: [
      {
        role: "user",
        content: buildBriefingPrompt({
          now: new Date(now).toISOString(),
          weekLabel: `이번 주(${weekStart} 주간)`,
          scope: opts.scopeLabel,
          events: selected,
        }),
      },
    ],
    maxTokens: 700,
    timeoutMs: 45_000,
  });

  const row = { user_id: opts.userId, week_start: weekStart, content: text.trim(), source_hash: hash, model };
  if (cached) {
    let upd = db.from("briefings").update({ ...row, created_at: new Date().toISOString() }).eq("week_start", weekStart);
    upd = opts.userId ? upd.eq("user_id", opts.userId) : upd.is("user_id", null);
    await upd;
  } else {
    await db.from("briefings").insert(row);
  }
  return { content: row.content, createdAt: new Date().toISOString(), model, cached: false };
}
