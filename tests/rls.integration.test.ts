/**
 * 실제 Supabase DB에서 인증·RLS 권한을 검증하는 통합 테스트.
 * INTEGRATION=1 일 때만 실행. 테스트 전용 계정을 만들고 끝나면 삭제한다.
 *   INTEGRATION=1 node --env-file=.env.local node_modules/.bin/vitest run tests/rls.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const run = process.env.INTEGRATION === "1" ? describe : describe.skip;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const tag = Date.now().toString(36);
const PASSWORD = `Test-${tag}-pw!`;

let service: SupabaseClient;
let anon: SupabaseClient;
let student: SupabaseClient;
let student2: SupabaseClient;
let admin: SupabaseClient;
const ids: Record<string, string> = {};

async function signIn(email: string) {
  const c = createClient(URL, ANON, opts);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

run("인증·RLS 통합 테스트", () => {
  beforeAll(async () => {
    service = createClient(URL, SERVICE, opts);
    anon = createClient(URL, ANON, opts);
    for (const [key, grade] of [["student", 2], ["student2", 1], ["admin", 3]] as const) {
      const { data, error } = await service.auth.admin.createUser({
        email: `rls-${key}-${tag}@caialender.test`,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: `테스트${key}`, student_no: "2027000000", grade: String(grade) },
      });
      if (error) throw error;
      ids[key] = data.user.id;
    }
    await service.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
    student = await signIn(`rls-student-${tag}@caialender.test`);
    student2 = await signIn(`rls-student2-${tag}@caialender.test`);
    admin = await signIn(`rls-admin-${tag}@caialender.test`);
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    await service.from("events").delete().like("title", `RLS-${tag}%`);
    await service.from("notices").delete().like("title", `RLS-${tag}%`);
    await service.storage.from("posters").remove([`rls-test/${tag}.png`]);
    for (const id of Object.values(ids)) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it("가입 시 프로필이 메타데이터로 자동 생성된다", async () => {
    const { data } = await student.from("profiles").select("*").eq("id", ids.student).single();
    expect(data).toMatchObject({ name: "테스트student", grade: 2, role: "student", student_no: "2027000000" });
  });

  it("학생은 자기 학년은 바꿀 수 있지만 role은 바꿀 수 없다", async () => {
    const ok = await student.from("profiles").update({ grade: 3 }).eq("id", ids.student);
    expect(ok.error).toBeNull();
    const bad = await student.from("profiles").update({ role: "admin" }).eq("id", ids.student);
    expect(bad.error).not.toBeNull();
    const { data } = await service.from("profiles").select("role, grade").eq("id", ids.student).single();
    expect(data).toEqual({ role: "student", grade: 3 });
  });

  it("학생은 다른 사람 프로필을 볼 수 없고, 관리자는 볼 수 있다", async () => {
    const s = await student.from("profiles").select("id").eq("id", ids.student2);
    expect(s.data).toEqual([]);
    const a = await admin.from("profiles").select("id").eq("id", ids.student2);
    expect(a.data).toHaveLength(1);
  });

  it("학생은 일정·공지를 만들 수 없다", async () => {
    const e = await student.from("events").insert({ title: `RLS-${tag}-hack`, start_at: new Date().toISOString(), status: "published" });
    expect(e.error).not.toBeNull();
    const n = await student.from("notices").insert({ title: `RLS-${tag}-hack` });
    expect(n.error).not.toBeNull();
  });

  it("관리자가 만든 초안은 학생·비로그인에게 안 보이고, 게시하면 보인다", async () => {
    const { data, error } = await admin
      .from("events")
      .insert({ title: `RLS-${tag}-event`, start_at: new Date().toISOString(), status: "draft", target_grades: [2] })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.event = data!.id;

    expect((await student.from("events").select("id").eq("id", ids.event)).data).toEqual([]);
    expect((await anon.from("events").select("id").eq("id", ids.event)).data).toEqual([]);

    await admin.from("events").update({ status: "published" }).eq("id", ids.event);
    expect((await student.from("events").select("id").eq("id", ids.event)).data).toHaveLength(1);
    expect((await anon.from("events").select("id").eq("id", ids.event)).data).toHaveLength(1);
  });

  it("학생은 게시된 일정을 수정·삭제할 수 없다", async () => {
    await student.from("events").update({ title: "hacked" }).eq("id", ids.event);
    await student.from("events").delete().eq("id", ids.event);
    const { data } = await service.from("events").select("title").eq("id", ids.event).single();
    expect(data?.title).toBe(`RLS-${tag}-event`);
  });

  it("관심 일정과 개인 일정은 본인 것만 보인다", async () => {
    expect((await student.from("user_events").insert({ user_id: ids.student, event_id: ids.event })).error).toBeNull();
    // 남의 이름으로 관심 일정 추가 불가
    expect((await student.from("user_events").insert({ user_id: ids.student2, event_id: ids.event })).error).not.toBeNull();
    expect((await student2.from("user_events").select("*")).data).toEqual([]);

    const start = new Date().toISOString();
    expect((await student.from("personal_events").insert({ title: "알바", start_at: start, end_at: start })).error).toBeNull();
    expect((await student2.from("personal_events").select("*")).data).toEqual([]);
    expect((await student.from("personal_events").select("*")).data).toHaveLength(1);
  });

  it("포스터 업로드는 관리자만 가능", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const s = await student.storage.from("posters").upload(`rls-test/${tag}-s.png`, png);
    expect(s.error).not.toBeNull();
    const a = await admin.storage.from("posters").upload(`rls-test/${tag}.png`, png);
    expect(a.error).toBeNull();
    // 비로그인은 다운로드 불가
    const d = await anon.storage.from("posters").download(`rls-test/${tag}.png`);
    expect(d.error).not.toBeNull();
  });

  it("작업 큐 함수(claim_notice_job)는 서버(service role)만 호출 가능", async () => {
    const s = await student.rpc("claim_notice_job", { p_id: null });
    expect(s.error).not.toBeNull();
    const a = await admin.rpc("claim_notice_job", { p_id: null });
    expect(a.error).not.toBeNull();
  });

  it("브리핑 캐시는 클라이언트에서 쓸 수 없다", async () => {
    const r = await admin.from("briefings").insert({ week_start: "2027-03-15", content: "x", source_hash: "x" });
    expect(r.error).not.toBeNull();
  });
});
