// 사용법: npm run import-academic -- 2026
// 경북대학교 홈페이지의 학사일정을 가져와 학사 캘린더에 게시한다. 다시 실행해도 중복되지 않는다(external_key).
import { createClient } from "@supabase/supabase-js";
import { KNU_SCHEDULE_URL, parseKnuSchedule } from "../lib/academic/knu-schedule.ts";

const year = Number(process.argv[2] ?? new Date().getFullYear());
if (!Number.isInteger(year) || year < 2000) {
  console.error("사용법: npm run import-academic -- <연도>");
  process.exit(1);
}

const res = await fetch(KNU_SCHEDULE_URL(year), { headers: { "user-agent": "Mozilla/5.0 (C:AI:ender academic import)" } });
if (!res.ok) throw new Error(`학사일정 페이지 응답 ${res.status}`);
const items = parseKnuSchedule(await res.text(), year);
if (items.length === 0) throw new Error(`${year}년 학사일정이 비어 있습니다.`);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const rows = items.map((i) => ({ ...i, calendar: "academic", status: "published", target_grades: [] }));
const { error } = await supabase.from("events").upsert(rows, { onConflict: "external_key" });
if (error) throw error;

const { count } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true })
  .eq("calendar", "academic")
  .like("external_key", `knu:${year}-%`);
console.log(`${year}년 학사일정 ${items.length}건 반영 (DB의 ${year}년 학사일정: ${count}건)`);
