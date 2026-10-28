import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { AIError, generateJson, type ContentPart } from "@/lib/ai/provider";
import {
  EXTRACTION_JSON_SCHEMA,
  buildExtractionSystemPrompt,
  normalizeExtraction,
  type ExtractedEvent,
} from "@/lib/ai/extract-schema";
import { diffEvent, summarizeChanges } from "@/lib/ai/change-detect";
import { formatKst, kstDate } from "@/lib/datetime";
import type { CalendarEvent, Notice } from "@/lib/types";

const MAX_ATTEMPTS = 3;

export type AnalyzeResult =
  | { ok: true; noticeId: string; created: number; changes: number; dropped: string[] }
  | { ok: false; noticeId: string; error: string; willRetry: boolean }
  | null;

/**
 * 대기 중인 공지 하나를 분석한다. id를 주면 그 공지만.
 * 분석 결과는 '검수 대기(draft)' 일정과 '변경 제안(event_changes)'으로 DB에 저장된다.
 * 게시는 항상 기획부가 검수 후 직접 한다.
 */
export async function analyzeNextNotice(id?: string): Promise<AnalyzeResult> {
  const db = createServiceClient();
  const { data: claimed, error: claimError } = await db.rpc("claim_notice_job", { p_id: id ?? null });
  if (claimError) throw claimError;
  const notice = (claimed as Notice[] | null)?.[0];
  if (!notice) return null;

  try {
    const result = await analyze(db, notice);
    return { ok: true, noticeId: notice.id, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const retryable = !(e instanceof AIError) || e.retryable;
    const willRetry = retryable && notice.attempts < MAX_ATTEMPTS;
    await db
      .from("notices")
      .update({ status: willRetry ? "queued" : "failed", last_error: message.slice(0, 1000), locked_at: null })
      .eq("id", notice.id);
    console.error(`[analyze] 공지 ${notice.id} 분석 실패 (시도 ${notice.attempts}):`, message);
    return { ok: false, noticeId: notice.id, error: message, willRetry };
  }
}

/** 대기열을 시간 예산 안에서 최대한 처리 (cron 재시도용) */
export async function drainQueue(budgetMs: number) {
  const started = Date.now();
  const results: AnalyzeResult[] = [];
  while (Date.now() - started < budgetMs) {
    const r = await analyzeNextNotice();
    if (!r) break;
    results.push(r);
  }
  return results;
}

async function analyze(db: SupabaseClient, notice: Notice) {
  // 같은 공지를 다시 분석하는 경우, 이 공지에서 나온 검수 전 결과는 지운다
  await db.from("events").delete().eq("notice_id", notice.id).eq("status", "draft");
  await db.from("event_changes").delete().eq("notice_id", notice.id).eq("status", "pending");

  const existing = await loadExistingEvents(db, notice.posted_at);
  const known = new Set(existing.map((e) => e.id));

  const content: ContentPart[] = [
    {
      type: "text",
      text: [
        `공지 게시 시각: ${formatKst(notice.posted_at)}`,
        `제목: ${notice.title}`,
        notice.body ? `본문:\n${notice.body}` : "본문 없음 (첨부 포스터 이미지를 읽어라)",
        "",
        "기존 일정 목록 (id | 종류 | 날짜 | 제목 | 장소):",
        existing.length
          ? existing
              .map((e) => `${e.id} | ${e.kind} | ${formatKst(e.start_at, !e.all_day)} | ${e.title} | ${e.location ?? "-"}`)
              .join("\n")
          : "(없음)",
      ].join("\n"),
    },
  ];
  if (notice.image_path) content.push({ type: "image_url", image_url: { url: await imageDataUrl(db, notice.image_path) } });

  const { data: raw, model } = await generateJson({
    schemaName: "notice_events",
    schema: EXTRACTION_JSON_SCHEMA,
    messages: [
      { role: "system", content: buildExtractionSystemPrompt(kstDate(notice.posted_at)) },
      { role: "user", content },
    ],
  });

  const { events, dropped } = normalizeExtraction(raw, known);
  const byId = new Map(existing.map((e) => [e.id, e]));

  // 같은 변경 제안이 이미 검토 대기 중이면 다시 만들지 않는다 (같은 공지가 여러 번 올라오는 경우)
  const { data: pending } = await db
    .from("event_changes")
    .select("event_id, changes")
    .eq("status", "pending")
    .in("event_id", existing.map((e) => e.id));
  const pendingKeys = new Set((pending ?? []).map((p) => `${p.event_id}:${JSON.stringify(p.changes)}`));

  const newEvents: ExtractedEvent[] = [];
  const changeRows: object[] = [];
  for (const ev of events) {
    const target = ev.existing_event_id ? byId.get(ev.existing_event_id) : undefined;
    if (!target) {
      newEvents.push(ev);
      continue;
    }
    const changes = diffEvent(target, ev);
    // 같은 일정을 다시 언급했을 뿐 바뀐 게 없거나, 같은 제안이 이미 대기 중이면 저장하지 않음
    const key = `${target.id}:${JSON.stringify(changes)}`;
    if (changes.length && !pendingKeys.has(key)) {
      pendingKeys.add(key);
      changeRows.push({
        event_id: target.id,
        notice_id: notice.id,
        changes,
        summary: summarizeChanges(target.title, changes),
      });
    }
  }

  if (newEvents.length) {
    const { error } = await db.from("events").insert(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      newEvents.map(({ existing_event_id, ...ev }) => ({ ...ev, notice_id: notice.id, status: "draft" })),
    );
    if (error) throw new Error(`일정 저장 실패: ${error.message}`);
  }
  if (changeRows.length) {
    const { error } = await db.from("event_changes").insert(changeRows);
    if (error) throw new Error(`변경 제안 저장 실패: ${error.message}`);
  }

  const { error } = await db
    .from("notices")
    .update({
      status: "analyzed",
      ai_result: { raw, dropped },
      ai_model: model,
      analyzed_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
    })
    .eq("id", notice.id);
  if (error) throw new Error(`공지 상태 저장 실패: ${error.message}`);

  return { created: newEvents.length, changes: changeRows.length, dropped };
}

async function loadExistingEvents(db: SupabaseClient, postedAt: string): Promise<CalendarEvent[]> {
  const from = new Date(new Date(postedAt).getTime() - 60 * 86400_000).toISOString();
  const { data, error } = await db
    .from("events")
    .select("*")
    .in("status", ["draft", "published"])
    .gte("start_at", from)
    .order("start_at")
    .limit(80);
  if (error) throw new Error(`기존 일정 조회 실패: ${error.message}`);
  return (data ?? []) as CalendarEvent[];
}

async function imageDataUrl(db: SupabaseClient, path: string) {
  const { data, error } = await db.storage.from("posters").download(path);
  if (error || !data) throw new Error(`포스터 이미지를 불러오지 못했습니다: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${data.type || "image/jpeg"};base64,${buf.toString("base64")}`;
}
