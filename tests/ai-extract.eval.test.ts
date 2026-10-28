/**
 * 실제 AI 모델로 공지 추출 품질·속도를 측정하는 평가 테스트.
 * 서비스(lib/jobs/analyze-notice.ts)와 같은 프롬프트 함수를 사용한다.
 * 기본 실행에서는 건너뛰고, AI_EVAL=1 일 때만 실행한다 (실제 API 호출 → 시간·비용 발생).
 *   AI_EVAL=1 node --env-file=.env.local node_modules/.bin/vitest run tests/ai-extract.eval.test.ts --silent=false
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { generateJson, type ContentPart } from "@/lib/ai/provider";
import {
  EXTRACTION_JSON_SCHEMA,
  buildExtractionSystemPrompt,
  buildExtractionUserText,
  normalizeExtraction,
} from "@/lib/ai/extract-schema";
import { diffEvent } from "@/lib/ai/change-detect";
import { kstDate, kstDateTime } from "@/lib/datetime";

const run = process.env.AI_EVAL === "1" ? describe : describe.skip;
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const kst = (s: string) => new Date(`${s}+09:00`).toISOString();

type Existing = Parameters<typeof buildExtractionUserText>[1];

async function extract(opts: { title: string; body: string; postedAt: string; image?: Buffer; existing?: Existing }) {
  const notice = { title: opts.title, body: opts.body, posted_at: kst(opts.postedAt) };
  const content: ContentPart[] = [{ type: "text", text: buildExtractionUserText(notice, opts.existing ?? []) }];
  if (opts.image) content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${opts.image.toString("base64")}` } });
  const t0 = Date.now();
  const { data, model } = await generateJson({
    schemaName: "notice_events",
    schema: EXTRACTION_JSON_SCHEMA,
    messages: [
      { role: "system", content: buildExtractionSystemPrompt(kstDate(notice.posted_at)) },
      { role: "user", content },
    ],
    timeoutMs: 600_000,
  });
  const seconds = (Date.now() - t0) / 1000;
  const result = normalizeExtraction(data, new Set((opts.existing ?? []).map((e) => e.id)), notice.posted_at);
  console.log(
    `[${model}] ${seconds.toFixed(1)}s ${opts.title}\n` +
      result.events
        .map((e) => `  - ${e.kind} | ${e.title} | ${kstDateTime(e.start_at)}${e.all_day ? "(종일)" : ""} ~ ${e.end_at ? kstDateTime(e.end_at) : "-"} | 장소:${e.location ?? "없음"} | 학년:${e.target_grades.join(",") || "전체"} (${e.target_note ?? "-"}) | 누락:${e.missing_fields.join(",") || "-"}${e.existing_event_id ? ` | 기존:${e.existing_event_id}` : ""}`)
        .join("\n"),
  );
  return result;
}

const at = (iso: string) => kstDateTime(iso);

run("AI 공지 추출 평가", () => {
  it("텍스트 공지: 행사와 마감을 분리한다", async () => {
    const { events } = await extract({
      title: "새내기 배움터 안내",
      body: fs.readFileSync(fixture("notice-saeteo.txt"), "utf8"),
      postedAt: "2027-02-01T10:00",
    });
    const main = events.find((e) => e.kind === "event" && e.title.includes("배움터"));
    expect(main).toBeDefined();
    expect(kstDate(main!.start_at)).toBe("2027-02-24");
    expect(main!.target_grades).toEqual([1]);
    expect(events.find((e) => e.kind === "deadline" && at(e.start_at) === "2027-02-13T23:59"), "신청 마감 2/13 23:59").toBeDefined();
  }, 600_000);

  it("포스터 이미지: 일시·장소·대상과 신청 마감을 읽는다", async () => {
    const { events } = await extract({
      title: "현직자 초청 특강 포스터",
      body: "",
      postedAt: "2027-03-02T10:00",
      image: fs.readFileSync(fixture("poster-lecture.png")),
    });
    const lecture = events.find((e) => e.kind === "event");
    expect(at(lecture!.start_at)).toBe("2027-03-18T16:00");
    expect(lecture?.location).toContain("224");
    expect(lecture?.target_grades).toEqual([2, 3, 4]);
    expect(events.some((e) => e.kind === "deadline" && kstDate(e.start_at) === "2027-03-15"), "신청 마감 3/15").toBe(true);
  }, 600_000);

  it("변경 공지: 기존 일정과 연결하고 장소 변경을 감지한다", async () => {
    const before = {
      id: "evt-lecture",
      kind: "event",
      title: "현직자 초청 특강",
      start_at: kst("2027-03-18T16:00"),
      end_at: kst("2027-03-18T18:00"),
      all_day: false,
      location: "IT-5호관 224호",
      target_grades: [2, 3, 4],
      description: "",
    };
    const { events } = await extract({
      title: "특강 장소 변경 안내",
      body: fs.readFileSync(fixture("notice-change.txt"), "utf8"),
      postedAt: "2027-03-10T10:00",
      existing: [before],
    });
    const linked = events.find((e) => e.existing_event_id === "evt-lecture");
    expect(linked, "기존 일정과 연결").toBeDefined();
    expect(diffEvent(before, linked!).map((c) => c.field)).toContain("location");
  }, 600_000);

  it("연도 없는 변경 공지를 몇 달 전에 올려도 다음 해 기존 일정과 연결한다", async () => {
    const before = {
      id: "evt-lecture",
      kind: "event",
      title: "현직자 초청 특강",
      start_at: kst("2027-03-18T16:00"),
      end_at: kst("2027-03-18T18:00"),
      all_day: false,
      location: "IT-5호관 224호",
      target_grades: [2, 3, 4],
      description: "",
    };
    const { events } = await extract({
      title: "특강 장소 변경 안내",
      body: fs.readFileSync(fixture("notice-change.txt"), "utf8"),
      postedAt: "2026-10-29T05:00",
      existing: [before],
    });
    // 변경 공지 항목의 종류(event/other)는 모델마다 다를 수 있으나, 기존 일정과 연결되고 날짜가 맞아야 한다
    const linked = events.find((e) => e.existing_event_id === "evt-lecture");
    expect(linked, "기존 일정과 연결").toBeDefined();
    expect(kstDate(linked!.start_at)).toBe("2027-03-18");
    expect(diffEvent(before, linked!).map((c) => c.field)).toEqual(["location"]);
  }, 600_000);

  // ── 실제 학과 공지 (사용자 제공, 2026-10-01 게시) ──
  const pickText = fs.readFileSync(fixture("notice-pickgaeting.txt"), "utf8");
  const pickPosterPath = fixture("private/pickgaeting-poster.png");
  const pickPoster = fs.existsSync(pickPosterPath) ? fs.readFileSync(pickPosterPath) : undefined;

  it("실제 공지(PICK개팅) 텍스트: '오늘(10.1.)' 상대 날짜, 6단대 재적생 대상, 장소 누락", async () => {
    const { events } = await extract({ title: "PICK개팅 참가자 모집 마감 안내", body: pickText, postedAt: "2026-10-01T12:00" });
    const main = events.find((e) => e.kind === "event");
    expect(main, "행사").toBeDefined();
    expect(at(main!.start_at)).toBe("2026-10-02T21:35");
    expect(main!.end_at && at(main!.end_at)).toBe("2026-10-02T21:55");
    expect(main!.target_grades).toEqual([]);
    expect(main!.target_note ?? "").toContain("6단대");
    // 공지에 장소가 없으므로 지어내면 안 된다
    expect(main!.location).toBeNull();
    expect(main!.missing_fields).toContain("장소");
    const deadline = events.find((e) => e.kind === "deadline");
    expect(deadline && at(deadline.start_at), "신청 마감 10/1 23:59").toBe("2026-10-01T23:59");
  }, 600_000);

  it.skipIf(!pickPoster)("실제 공지(PICK개팅) 포스터만: 일시와 포스터의 마감일(9/30)을 읽는다", async () => {
    const { events } = await extract({ title: "PICK개팅 포스터", body: "", postedAt: "2026-09-28T12:00", image: pickPoster });
    const main = events.find((e) => e.kind === "event");
    expect(main && at(main.start_at)).toBe("2026-10-02T21:35");
    const deadline = events.find((e) => e.kind === "deadline");
    expect(deadline && at(deadline.start_at), "포스터 마감 9/30 23:59").toBe("2026-09-30T23:59");
  }, 600_000);

  it.skipIf(!pickPoster)("실제 공지(PICK개팅) 텍스트+포스터: 마감일이 서로 다르면 최신 본문(10/1)을 따른다", async () => {
    const { events } = await extract({ title: "PICK개팅 참가자 모집 마감 안내", body: pickText, postedAt: "2026-10-01T12:00", image: pickPoster });
    const main = events.find((e) => e.kind === "event");
    expect(main && at(main.start_at)).toBe("2026-10-02T21:35");
    const deadlines = events.filter((e) => e.kind === "deadline").map((e) => at(e.start_at));
    expect(deadlines, "본문의 연장된 마감(10/1)").toContain("2026-10-01T23:59");
  }, 600_000);
});
