import "server-only";
// 에타 시간표 스크린샷 → 수업 목록. 칸 위치(시각)는 픽셀로 재고(lib/timetable-vision), 칸 안 글자만 AI가 읽는다.
import sharp from "sharp";
import { AIError, generateJson } from "@/lib/ai/provider";
import {
  BLOCK_TEXT_JSON_SCHEMA,
  BLOCK_TEXT_SYSTEM_PROMPT,
  COURSE_COLORS,
  coursesFromBlocks,
  DAY_LABELS,
  hhmm,
  normalizeTimetable,
  TIMETABLE_JSON_SCHEMA,
  TIMETABLE_SYSTEM_PROMPT,
  type TimetableCourse,
} from "@/lib/timetable";
import { blockRect, detectBlocks, detectGrid, firstHourRect, mergeWithBlocks, toLightMode } from "@/lib/timetable-vision";

/** 아주 작은 캡처는 선·칸 경계가 1px 안쪽으로 뭉개지므로 키워서 잰다 (가로 900px 정도) */
async function upscaleSmall(bytes: Buffer): Promise<Buffer> {
  const { width } = await sharp(bytes).metadata();
  if (!width || width >= 600) return bytes;
  return sharp(bytes).resize({ width: Math.min(width * 4, 900), kernel: "lanczos3" }).png().toBuffer();
}

export async function analyzeByBlocks(original: Buffer): Promise<{ courses: TimetableCourse[]; dropped: string[] } | null> {
  const bytes = await upscaleSmall(original);
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // 다크 모드 캡처는 라이트 모드처럼 바꿔서 잰다 (AI에게 보낼 칸 사진은 원본 그대로)
  const img = toLightMode({ data, width: info.width, height: info.height, channels: info.channels });
  const grid = detectGrid(img);
  if (!grid) return null;
  const blocks = detectBlocks(img, grid, 9);
  if (blocks.length === 0 || blocks.length > 40) return null;

  // 칸마다 잘라서 글자가 잘 보이게 키운다
  const dark = img.data !== data;
  const crop = async (r: { left: number; top: number; width: number; height: number }, invert = false) => {
    // 글자가 또렷하도록 가로 480px 이상으로 키운다 (작은 캡처는 최대 4배)
    const scale = Math.min(4, Math.max(1.5, 480 / r.width));
    let p = sharp(bytes)
      .extract(r)
      .resize({ width: Math.round(r.width * scale), kernel: "lanczos3" });
    if (invert) p = p.negate({ alpha: false });
    const png = await p.png().toBuffer();
    return { type: "image_url" as const, image_url: { url: `data:image/png;base64,${png.toString("base64")}` } };
  };
  // 다크 모드의 시간 숫자는 검은 바탕 회색 글씨라 흰 바탕 검은 글씨로 뒤집어 보낸다 (수업 칸은 원래 밝은 바탕이라 그대로)
  const images = await Promise.all([crop(firstHourRect(grid), dark), ...blocks.map((b) => crop(blockRect(grid, b)))]);
  const { data: raw } = await generateJson({
    messages: [
      { role: "system", content: BLOCK_TEXT_SYSTEM_PROMPT },
      { role: "user", content: [{ type: "text", text: `시간 숫자 칸 1개와 수업 칸 ${blocks.length}개의 글자를 읽어 줘.` }, ...images] },
    ],
    schema: BLOCK_TEXT_JSON_SCHEMA,
    schemaName: "timetable_blocks",
    maxTokens: 3000,
    timeoutMs: 90_000,
    // 글자를 정확히 읽는 큰 이미지 모델 (실패하면 기본 모델로 넘어간다)
    model: process.env.AI_TIMETABLE_MODEL || undefined,
  });
  const { courses: read, startHour } = coursesFromBlocks(raw, blocks);
  // 맨 위 시각이 9시가 아니면 모든 칸을 옮긴다 (칸 시각은 9시 기준으로 잰 값)
  const shift = ((startHour ?? 9) - 9) * 60;
  if (shift) for (const c of read) for (const sl of c.slots) Object.assign(sl, { start_min: sl.start_min + shift, end_min: sl.end_min + shift });
  return { courses: read, dropped: [] };
}

/** 예비: 전체 이미지를 AI가 읽고, 눈금을 찾으면 시각은 픽셀 값으로 바꾼다 */
export async function analyzeWholeImage(bytes: Buffer, type: string): Promise<{ courses?: TimetableCourse[]; dropped?: string[]; error?: string }> {
  const url = `data:${type};base64,${bytes.toString("base64")}`;
  const pixels = upscaleSmall(bytes)
    .then((b) => sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }))
    .then(({ data, info }) => toLightMode({ data, width: info.width, height: info.height, channels: info.channels }))
    .catch(() => null);
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
      // 시간표 칸의 위치(시각)를 정확히 읽는 큰 이미지 모델
      model: process.env.AI_TIMETABLE_MODEL || undefined,
    });
    const { courses: aiCourses, dropped, startHour } = normalizeTimetable(data);
    if (!aiCourses.length) return { error: "시간표에서 수업을 찾지 못했어요. 시간표 전체가 보이게 캡처해 주세요.", dropped };
    const img = await pixels;
    const grid = img ? detectGrid(img) : null;
    if (!img || !grid) return { courses: aiCourses, dropped: [...dropped, "시간표 눈금을 찾지 못해 AI가 읽은 시각을 썼어요"] };
    const blocks = detectBlocks(img, grid, startHour ?? 9);
    const { courses, unmatched } = mergeWithBlocks(aiCourses, blocks);
    for (const b of unmatched) {
      courses.push({
        name: "수업 (이름 확인 필요)",
        professor: null,
        color: courses.length % COURSE_COLORS.length,
        reminder: false,
        slots: [{ day: b.day, start_min: b.start_min, end_min: b.end_min, location: null }],
        check: `${DAY_LABELS[b.day]} ${hhmm(b.start_min)}-${hhmm(b.end_min)} 칸의 이름을 읽지 못했어요`,
      });
    }
    return { courses, dropped };
  } catch (e) {
    console.error("[timetable] AI 분석 실패:", e);
    return { error: e instanceof AIError ? "지금은 AI가 시간표를 읽을 수 없어요. 잠시 후 다시 하거나 직접 추가해 주세요." : "시간표를 읽지 못했어요." };
  }
}
