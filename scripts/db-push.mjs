// supabase/migrations 의 SQL을 원격 Supabase DB에 적용한다
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 .env.local에 없습니다.");
  process.exit(1);
}
const r = spawnSync("npx", ["supabase", "db", "push", "--db-url", url, "--include-all", "--yes"], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
