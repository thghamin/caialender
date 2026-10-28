// 사용법: npm run make-admin -- someone@example.com
// 해당 이메일 사용자를 학생회 기획부 관리자로 지정한다
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("사용법: npm run make-admin -- <email>");
  process.exit(1);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let user;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`${email} 사용자를 찾을 수 없습니다. 먼저 회원가입하세요.`);
  process.exit(1);
}
const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
if (error) throw error;
console.log(`${email} → 관리자 지정 완료`);
