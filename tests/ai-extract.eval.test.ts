/**
 * 실제 AI 모델로 공지 추출 품질·속도를 측정하는 평가 테스트.
 * 기본 실행에서는 건너뛰고, AI_EVAL=1 일 때만 실행한다 (실제 API 호출 → 시간·비용 발생).
 *   AI_EVAL=1 AI_BASE_URL=http://127.0.0.1:11434/v1 AI_MODEL=qwen3-vl:4b-instruct npx vitest run tests/ai-extract.eval.test.ts
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { generateJson, type ContentPart } from "@/lib/ai/provider";
import { EXTRACTION_JSON_SCHEMA, buildExtractionSystemPrompt, normalizeExtraction } from "@/lib/ai/extract-schema";
import { diffEvent } from "@/lib/ai/change-detect";
import { kstDate } from "@/lib/datetime";

const run = process.env.AI_EVAL === "1" ? describe : describe.skip;
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);

async function extract(text: string, opts: { today: string; image?: Buffer; existing?: string }) {
  const content: ContentPart[] = [
    { type: "text", text: `${text}\n\n기존 일정 목록 (id | 종류 | 날짜 | 제목 | 장소):\n${opts.existing ?? "(없음)"}` },
  ];
  if (opts.image) content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${opts.image.toString("base64")}` } });
  const t0 = Date.now();
  const { data, model } = await generateJson({
    schemaName: "notice_events",
    schema: EXTRACTION_JSON_SCHEMA,
    messages: [
      { role: "system", content: buildExtractionSystemPrompt(opts.today) },
      { role: "user", content },
    ],
    timeoutMs: 600_000,
  });
  const seconds = (Date.now() - t0) / 1000;
  const known = new Set(["evt-lecture"]);
  const result = normalizeExtraction(data, known);
  console.log(`[${model}] ${seconds.toFixed(1)}s`, JSON.stringify(result.events, null, 1));
  return result;
}

run("AI 공지 추출 평가", () => {
  it("텍스트 공지: 행사와 마감 2건 이상을 분리한다", async () => {
    const text = fs.readFileSync(fixture("notice-saeteo.txt"), "utf8");
    const { events } = await extract(`제목: 새내기 배움터 안내\n본문:\n${text}`, { today: "2027-02-01" });
    const main = events.find((e) => e.kind === "event" && e.title.includes("배움터"));
    expect(main).toBeDefined();
    expect(kstDate(main!.start_at)).toBe("2027-02-24");
    expect(main!.target_grades).toEqual([1]);
    const deadline = events.find((e) => e.kind === "deadline" && kstDate(e.start_at) === "2027-02-13");
    expect(deadline, "신청 마감(2/13)").toBeDefined();
  }, 600_000);

  it("포스터 이미지: 일시·장소·대상과 신청 마감을 읽는다", async () => {
    const image = fs.readFileSync(fixture("poster-lecture.png"));
    const { events } = await extract("제목: 현직자 초청 특강 포스터\n본문 없음 (첨부 포스터 이미지를 읽어라)", {
      today: "2027-03-02",
      image,
    });
    const lecture = events.find((e) => e.kind === "event");
    expect(lecture?.start_at).toBe("2027-03-18T07:00:00.000Z");
    expect(lecture?.location).toContain("224");
    expect(lecture?.target_grades).toEqual([2, 3, 4]);
    expect(events.some((e) => e.kind === "deadline" && kstDate(e.start_at) === "2027-03-15"), "신청 마감(3/15)").toBe(true);
  }, 600_000);

  it("변경 공지: 기존 일정과 연결하고 장소 변경을 감지한다", async () => {
    const text = fs.readFileSync(fixture("notice-change.txt"), "utf8");
    const { events } = await extract(`제목: 특강 장소 변경 안내\n본문:\n${text}`, {
      today: "2027-03-10",
      existing: "evt-lecture | event | 3월 18일(목) 16:00 | 현직자 초청 특강 | IT-5호관 224호",
    });
    const linked = events.find((e) => e.existing_event_id === "evt-lecture");
    expect(linked, "기존 일정과 연결").toBeDefined();
    const changes = diffEvent(
      {
        title: "현직자 초청 특강",
        start_at: "2027-03-18T07:00:00.000Z",
        end_at: "2027-03-18T09:00:00.000Z",
        all_day: false,
        location: "IT-5호관 224호",
        target_grades: [2, 3, 4],
        description: "",
      },
      linked!,
    );
    expect(changes.map((c) => c.field)).toContain("location");
  }, 600_000);
});
