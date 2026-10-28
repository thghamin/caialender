// 사용법: npm run setup-cron -- https://caialender.vercel.app
// Supabase pg_cron에 1분마다 /api/jobs/analyze 를 호출하는 재시도 작업을 등록한다
import { createClient } from "@supabase/supabase-js";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("사용법: npm run setup-cron -- https://배포주소");
  process.exit(1);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await supabase.rpc("setup_analyze_cron", {
  p_url: `${base}/api/jobs/analyze`,
  p_secret: process.env.CRON_SECRET,
});
if (error) throw error;
console.log(data);
