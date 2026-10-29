// 사용법: npm run make-admin -- someone@example.com [admin|super_admin|student]
// 해당 이메일 사용자의 역할을 바꾼다. 기본은 admin(학생회 관리자).
// 총관리자(super_admin)는 이 스크립트로만 지정하고, 관리자 임명은 총관리자가 웹의 '관리자 임명' 화면에서 한다.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const role = process.argv[3] ?? "admin";
if (!email || !["admin", "super_admin", "student"].includes(role)) {
  console.error("사용법: npm run make-admin -- <email> [admin|super_admin|student]");
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
const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
if (error) throw error;
console.log(`${email} → ${role} 지정 완료`);
