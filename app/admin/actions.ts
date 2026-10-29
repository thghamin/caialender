"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kstToIso } from "@/lib/datetime";
import { analyzeNextNotice } from "@/lib/jobs/analyze-notice";
import { KNU_SCHEDULE_URL, parseKnuSchedule } from "@/lib/academic/knu-schedule";
import type { FieldChange } from "@/lib/ai/change-detect";

export type FormState = { error?: string; message?: string } | undefined;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** 공지 등록 → 저장 즉시 응답하고, AI 분석은 응답 이후 백그라운드에서 실행 */
export async function createNotice(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const postedAt = kstToIso(String(formData.get("posted_at") ?? ""));
  const image = formData.get("image");
  const hasImage = image instanceof File && image.size > 0;

  if (!title) return { error: "제목을 입력하세요." };
  if (!body && !hasImage) return { error: "공지 본문이나 포스터 이미지 중 하나는 있어야 합니다." };
  if (hasImage && !IMAGE_TYPES.includes(image.type)) return { error: "PNG, JPG, WEBP 이미지만 올릴 수 있습니다." };
  if (hasImage && image.size > MAX_IMAGE_BYTES) return { error: "이미지는 8MB 이하만 올릴 수 있습니다." };

  const supabase = await createClient();
  let imagePath: string | null = null;
  if (hasImage) {
    const ext = image.type.split("/")[1].replace("jpeg", "jpg");
    imagePath = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("posters").upload(imagePath, image, { contentType: image.type });
    if (error) return { error: `이미지 업로드 실패: ${error.message}` };
  }

  const { data, error } = await supabase
    .from("notices")
    .insert({
      title,
      body,
      image_path: imagePath,
      posted_at: postedAt?.iso ?? new Date().toISOString(),
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error) return { error: `공지 저장 실패: ${error.message}` };

  after(() => analyzeNextNotice(data.id).catch((e) => console.error("[analyze] after() 실패", e)));
  revalidatePath("/admin");
  redirect(`/admin/notices/${data.id}`);
}

/** 재분석: 실패했거나 결과가 마음에 들지 않을 때 */
export async function reanalyzeNotice(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notices")
    .update({ status: "queued", attempts: 0, last_error: null, locked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  after(() => analyzeNextNotice(id).catch((e) => console.error("[analyze] after() 실패", e)));
  revalidatePath(`/admin/notices/${id}`);
}

export async function deleteNotice(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: notice } = await supabase.from("notices").select("image_path").eq("id", id).single();
  // 검수 전 초안만 함께 지우고, 이미 게시된 일정은 남긴다(notice_id는 null이 됨)
  await supabase.from("events").delete().eq("notice_id", id).eq("status", "draft");
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (notice?.image_path) await supabase.storage.from("posters").remove([notice.image_path]);
  revalidatePath("/admin");
  redirect("/admin");
}

const eventSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요.").max(120),
  calendar: z.enum(["dept", "academic"]).optional().default("dept"),
  kind: z.enum(["event", "deadline", "other"]),
  start: z.string().min(1, "시작 일시를 입력하세요."),
  end: z.string().optional().default(""),
  all_day: z.string().optional(),
  location: z.string().trim().max(200).optional().default(""),
  target_note: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(3000).optional().default(""),
  status: z.enum(["draft", "published", "archived"]),
});

function parseEventForm(formData: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  const allDay = d.all_day === "on";
  const start = kstToIso(allDay ? d.start.slice(0, 10) : d.start);
  const end = d.end ? kstToIso(allDay ? d.end.slice(0, 10) : d.end) : null;
  if (!start) return { error: "시작 일시 형식이 올바르지 않습니다." } as const;
  if (d.end && !end) return { error: "종료 일시 형식이 올바르지 않습니다." } as const;
  if (end && end.iso < start.iso) return { error: "종료가 시작보다 빠를 수 없습니다." } as const;
  const grades = formData.getAll("target_grades").map(Number).filter((g) => g >= 1 && g <= 4);
  return {
    row: {
      title: d.title,
      calendar: d.calendar,
      kind: d.kind,
      start_at: start.iso,
      end_at: end?.iso ?? null,
      all_day: allDay,
      location: d.location || null,
      target_grades: grades,
      target_note: d.target_note || null,
      description: d.description,
      status: d.status,
    },
  } as const;
}

export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  if (id) {
    // 사람이 고친 항목은 더 이상 '누락'이 아니므로 누락 목록에서 정리
    const { data: current } = await supabase.from("events").select("missing_fields").eq("id", id).single();
    const missing = (current?.missing_fields ?? []).filter(
      (f: string) => !((f === "장소" && parsed.row.location) || (f === "시간" && !parsed.row.all_day)),
    );
    const { error } = await supabase.from("events").update({ ...parsed.row, missing_fields: missing }).eq("id", id);
    if (error) return { error: `저장 실패: ${error.message}` };
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...parsed.row, created_by: admin.id })
      .select("id")
      .single();
    if (error) return { error: `저장 실패: ${error.message}` };
    revalidatePath("/", "layout");
    redirect(`/admin/events/${data.id}`);
  }
  revalidatePath("/", "layout");
  return { message: parsed.row.status === "published" ? "저장하고 게시했습니다." : "저장했습니다." };
}

/** 공지에서 나온 검수 대기 초안을 한 번에 게시 */
export async function publishNoticeDrafts(noticeId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "published" })
    .eq("notice_id", noticeId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteEvent(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** AI가 제안한 변경을 실제 일정에 반영하거나 무시 */
export async function resolveChange(changeId: string, apply: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: change, error } = await supabase
    .from("event_changes")
    .select("id, event_id, changes, status")
    .eq("id", changeId)
    .single();
  if (error || !change) throw new Error(error?.message ?? "변경 제안을 찾을 수 없습니다.");
  if (change.status !== "pending") return;

  if (apply) {
    const patch: Record<string, unknown> = {};
    for (const c of change.changes as FieldChange[]) patch[c.field] = c.after;
    const { error: upErr } = await supabase.from("events").update(patch).eq("id", change.event_id);
    if (upErr) throw new Error(upErr.message);
  }
  await supabase.from("event_changes").update({ status: apply ? "applied" : "dismissed" }).eq("id", changeId);
  revalidatePath("/", "layout");
}

/** 경북대 홈페이지에서 학사일정을 다시 불러온다. 같은 일정은 external_key로 덮어써서 중복되지 않는다 */
export async function importAcademicSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: "연도를 확인하세요." };

  let items;
  try {
    const res = await fetch(KNU_SCHEDULE_URL(year), {
      headers: { "user-agent": "Mozilla/5.0 (C:AI:ender academic import)" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return { error: `경북대 홈페이지 응답 오류(${res.status})` };
    items = parseKnuSchedule(await res.text(), year);
  } catch (e) {
    return { error: `학사일정을 가져오지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (items.length === 0) return { error: `${year}년 학사일정이 아직 홈페이지에 없습니다.` };

  const supabase = await createClient();
  const rows = items.map((i) => ({ ...i, calendar: "academic", status: "published", target_grades: [] }));
  const { error } = await supabase.from("events").upsert(rows, { onConflict: "external_key" });
  if (error) return { error: `저장 실패: ${error.message}` };
  revalidatePath("/", "layout");
  return { message: `${year}년 학사일정 ${items.length}건을 반영했습니다.` };
}
