"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AIError, generateJson } from "@/lib/ai/provider";
import { COURSE_COLORS, normalizeTimetable, TIMETABLE_JSON_SCHEMA, TIMETABLE_SYSTEM_PROMPT, type TimetableCourse } from "@/lib/timetable";

const slotSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start_min: z.number().int().min(0).max(1435),
    end_min: z.number().int().min(5).max(1440),
    location: z.string().trim().max(80).nullable(),
  })
  .refine((s) => s.end_min > s.start_min, { message: "끝나는 시간이 시작 시간보다 늦어야 해요." })
  .refine((s) => s.start_min % 5 === 0 && s.end_min % 5 === 0, { message: "시간은 5분 단위로 정해 주세요." });

const courseSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "수업명을 입력하세요.").max(60),
  professor: z.string().trim().max(40).nullable(),
  color: z.number().int().min(0).max(COURSE_COLORS.length - 1),
  reminder: z.boolean(),
  slots: z.array(slotSchema).min(1, "시간을 하나 이상 넣어 주세요.").max(10),
});

type Result = { error?: string };

async function insertCourse(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, c: z.infer<typeof courseSchema>, source: "manual" | "ai") {
  const { data, error } = await supabase
    .from("timetable_courses")
    .insert({ user_id: userId, name: c.name, professor: c.professor || null, color: c.color, reminder: c.reminder, source })
    .select("id")
    .single();
  if (error) return error.message;
  const { error: e2 } = await supabase
    .from("timetable_slots")
    .insert(c.slots.map((s) => ({ ...s, location: s.location || null, course_id: data.id, user_id: userId })));
  return e2?.message;
}

/** 수업 추가·수정 (수정은 시간 칸을 통째로 바꾼다) */
export async function saveCourse(input: TimetableCourse): Promise<Result> {
  const user = await requireUser();
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = parsed.data;
  const supabase = await createClient();
  if (c.id) {
    const { error } = await supabase
      .from("timetable_courses")
      .update({ name: c.name, professor: c.professor || null, color: c.color, reminder: c.reminder })
      .eq("id", c.id);
    if (error) return { error: error.message };
    await supabase.from("timetable_slots").delete().eq("course_id", c.id);
    const { error: e2 } = await supabase
      .from("timetable_slots")
      .insert(c.slots.map((s) => ({ ...s, location: s.location || null, course_id: c.id, user_id: user.id })));
    if (e2) return { error: e2.message };
  } else {
    const err = await insertCourse(supabase, user.id, c, "manual");
    if (err) return { error: err };
  }
  revalidatePath("/timetable");
  return {};
}

export async function deleteCourse(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("timetable_courses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/timetable");
  return {};
}

/** 수업 10분 전 알림 켜기/끄기 */
export async function setCourseReminder(id: string, on: boolean): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("timetable_courses").update({ reminder: on }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/timetable");
  return {};
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** 에브리타임 시간표 스크린샷을 AI로 읽어 수업 목록을 돌려준다 (아직 저장하지 않음, 사용자가 확인 후 저장) */
export async function analyzeTimetableImage(formData: FormData): Promise<{ courses?: TimetableCourse[]; dropped?: string[]; error?: string }> {
  await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "시간표 스크린샷을 골라 주세요." };
  if (!IMAGE_TYPES.includes(file.type)) return { error: "PNG·JPG·WEBP 이미지만 올릴 수 있어요." };
  if (file.size > 8 * 1024 * 1024) return { error: "이미지는 8MB 이하로 올려 주세요." };

  const url = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  try {
    const { data } = await generateJson({
      messages: [
        { role: "system", content: TIMETABLE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "이 에브리타임 시간표 스크린샷의 수업을 모두 읽어 줘." },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
      schema: TIMETABLE_JSON_SCHEMA,
      schemaName: "timetable",
      maxTokens: 3000,
      timeoutMs: 90_000,
      // 시간표 칸의 위치(시각)를 정확히 읽는 큰 이미지 모델 (측정: 75분 수업을 15분 단위까지 맞춤, 약 35초)
      model: process.env.AI_TIMETABLE_MODEL || undefined,
    });
    const { courses, dropped } = normalizeTimetable(data);
    if (!courses.length) return { error: "시간표에서 수업을 찾지 못했어요. 시간표 전체가 보이게 캡처해 주세요.", dropped };
    return { courses, dropped };
  } catch (e) {
    console.error("[timetable] AI 분석 실패:", e);
    return { error: e instanceof AIError ? "지금은 AI가 시간표를 읽을 수 없어요. 잠시 후 다시 하거나 직접 추가해 주세요." : "시간표를 읽지 못했어요." };
  }
}

/** AI가 읽은 수업들을 한 번에 저장. replace면 기존 시간표를 지우고 바꾼다 */
export async function importCourses(courses: TimetableCourse[], replace: boolean): Promise<Result & { saved?: number }> {
  const user = await requireUser();
  const parsed = z.array(courseSchema).min(1).max(40).safeParse(courses);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  if (replace) {
    const { error } = await supabase.from("timetable_courses").delete().eq("user_id", user.id);
    if (error) return { error: error.message };
  }
  for (const c of parsed.data) {
    const err = await insertCourse(supabase, user.id, c, "ai");
    if (err) return { error: err };
  }
  revalidatePath("/timetable");
  return { saved: parsed.data.length };
}
