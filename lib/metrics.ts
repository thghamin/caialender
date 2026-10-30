import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { findEvidence } from "@/lib/ai/extract-schema";

/**
 * 학생회 관리 화면의 성과 지표. DB에 실제로 기록된 값만 센다(추정치 없음).
 * 관리자 확인(requireAdmin) 뒤에만 호출할 것.
 */
export async function getAdminMetrics() {
  const db = createServiceClient();
  const [notices, events, changes, questions, interests, reminders, courses] = await Promise.all([
    db.from("notices").select("id, body, status, created_at, analyzed_at"),
    db.from("events").select("notice_id, status, ai_edited, missing_fields, evidence").not("notice_id", "is", null),
    db.from("event_changes").select("status"),
    db.from("questions").select("created_at, answered_at"),
    db.from("user_events").select("*", { count: "exact", head: true }),
    db.from("event_reminders").select("*", { count: "exact", head: true }),
    db.from("timetable_courses").select("*", { count: "exact", head: true }).eq("reminder", true),
  ]);
  const n = notices.data ?? [];
  const e = events.data ?? [];
  const q = questions.data ?? [];

  const analyzed = n.filter((x) => x.status === "analyzed");
  const failed = n.filter((x) => x.status === "failed").length;
  const durations = analyzed
    .filter((x) => x.analyzed_at)
    .map((x) => (new Date(x.analyzed_at!).getTime() - new Date(x.created_at).getTime()) / 1000)
    .filter((s) => s >= 0 && s < 3600);
  const published = e.filter((x) => x.status === "published");
  const bodies = new Map(n.map((x) => [x.id, x.body as string]));
  const withEvidence = e.filter((x) => x.evidence && bodies.get(x.notice_id!));
  const verified = withEvidence.filter((x) => findEvidence(bodies.get(x.notice_id!)!, x.evidence)).length;
  const answered = q.filter((x) => x.answered_at);
  const answerHours = answered.map((x) => (new Date(x.answered_at!).getTime() - new Date(x.created_at).getTime()) / 3600_000);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

  return {
    notices: n.length,
    analyzeSuccessPct: pct(analyzed.length, analyzed.length + failed),
    avgAnalyzeSec: avg(durations),
    aiEvents: e.length,
    publishedAi: published.length,
    publishedAsIsPct: pct(published.filter((x) => !x.ai_edited).length, published.length),
    missingFlagged: e.filter((x) => (x.missing_fields ?? []).length > 0).length,
    evidenceVerifiedPct: pct(verified, withEvidence.length),
    evidenceChecked: withEvidence.length,
    changesDetected: (changes.data ?? []).length,
    changesApplied: (changes.data ?? []).filter((x) => x.status === "applied").length,
    questions: q.length,
    answeredPct: pct(answered.length, q.length),
    avgAnswerHours: avg(answerHours),
    interests: interests.count ?? 0,
    reminders: (reminders.count ?? 0) + (courses.count ?? 0),
  };
}
