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
// 학번은 중복 가입이 막혀 있으므로 계정마다 다르게
const SN_BASE = String(Date.now()).slice(-7);
const studentNo = (i: number) => `29${SN_BASE}${i}`;

let service: SupabaseClient;
let anon: SupabaseClient;
let student: SupabaseClient;
let student2: SupabaseClient;
let admin: SupabaseClient;
let superAdmin: SupabaseClient;
let pendingUser: SupabaseClient;
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
    const keys = [["student", 2], ["student2", 1], ["admin", 3], ["super", 4], ["pending", 1]] as const;
    for (const [i, [key, grade]] of keys.entries()) {
      const { data, error } = await service.auth.admin.createUser({
        email: `rls-${key}-${tag}@caialender.test`,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: `테스트${key}`, student_no: studentNo(i), grade: String(grade), department: "인공지능전공" },
      });
      if (error) throw error;
      ids[key] = data.user.id;
    }
    // 가입 직후는 모두 승인 대기. pending 계정만 남기고 승인한다
    await service
      .from("profiles")
      .update({ approval_status: "approved" })
      .in("id", [ids.student, ids.student2, ids.admin, ids.super]);
    await service.from("profiles").update({ role: "admin" }).eq("id", ids.admin);
    await service.from("profiles").update({ role: "super_admin" }).eq("id", ids.super);
    student = await signIn(`rls-student-${tag}@caialender.test`);
    student2 = await signIn(`rls-student2-${tag}@caialender.test`);
    admin = await signIn(`rls-admin-${tag}@caialender.test`);
    superAdmin = await signIn(`rls-super-${tag}@caialender.test`);
    pendingUser = await signIn(`rls-pending-${tag}@caialender.test`);
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
    expect(data).toMatchObject({ name: "테스트student", grade: 2, role: "student", student_no: studentNo(0), department: "인공지능전공" });
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

  it("관리자가 만든 초안은 학생·비로그인에게 안 보이고, 게시하면 승인된 학생에게만 보인다", async () => {
    const { data, error } = await admin
      .from("events")
      .insert({ title: `RLS-${tag}-event`, start_at: new Date().toISOString(), status: "draft", target_grades: [2] })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.event = data!.id;

    expect((await student.from("events").select("id").eq("id", ids.event)).data).toEqual([]);
    // 비로그인은 조회 권한 자체가 없어 오류(data null)로 막힌다
    expect((await anon.from("events").select("id").eq("id", ids.event)).data ?? []).toEqual([]);

    await admin.from("events").update({ status: "published" }).eq("id", ids.event);
    expect((await student.from("events").select("id").eq("id", ids.event)).data).toHaveLength(1);
    // 서비스가 로그인·승인 필수가 되면서 비로그인과 승인 대기 회원에게는 안 보인다
    expect((await anon.from("events").select("id").eq("id", ids.event)).data ?? []).toEqual([]);
    expect((await pendingUser.from("events").select("id").eq("id", ids.event)).data).toEqual([]);
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

  it("총관리자만 관리자를 임명·해제할 수 있다", async () => {
    const role = async (id: string) => (await service.from("profiles").select("role").eq("id", id).single()).data?.role;

    // 학생과 일반 관리자는 임명할 수 없다
    expect((await student.rpc("set_user_role", { p_user: ids.student, p_role: "admin" })).error).not.toBeNull();
    expect((await admin.rpc("set_user_role", { p_user: ids.student2, p_role: "admin" })).error).not.toBeNull();
    expect(await role(ids.student2)).toBe("student");

    // 총관리자는 임명하고 해제할 수 있다
    expect((await superAdmin.rpc("set_user_role", { p_user: ids.student2, p_role: "admin" })).error).toBeNull();
    expect(await role(ids.student2)).toBe("admin");
    expect((await superAdmin.rpc("set_user_role", { p_user: ids.student2, p_role: "student" })).error).toBeNull();
    expect(await role(ids.student2)).toBe("student");

    // 총관리자 지정, 자기 자신 변경은 막는다
    expect((await superAdmin.rpc("set_user_role", { p_user: ids.student, p_role: "super_admin" })).error).not.toBeNull();
    expect((await superAdmin.rpc("set_user_role", { p_user: ids.super, p_role: "student" })).error).not.toBeNull();
    expect(await role(ids.super)).toBe("super_admin");
  });

  it("총관리자도 관리자 권한(일정 작성)을 가진다", async () => {
    const { data, error } = await superAdmin
      .from("events")
      .insert({ title: `RLS-${tag} 학사 테스트`, calendar: "academic", start_at: new Date().toISOString(), status: "published", all_day: true })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: seen } = await student.from("events").select("id, calendar").eq("id", data!.id).single();
    expect(seen?.calendar).toBe("academic");
  });

  it("질문 게시판: 학생은 질문만, 답변은 관리자만", async () => {
    const { data: q, error } = await student
      .from("questions")
      .insert({ user_id: ids.student, body: `RLS-${tag} 회비는 얼마인가요?` })
      .select("id")
      .single();
    expect(error).toBeNull();

    // 다른 사람 이름으로 질문하거나, 질문하면서 답변을 넣을 수 없다
    expect((await student.from("questions").insert({ user_id: ids.student2, body: "사칭" })).error).not.toBeNull();
    expect((await student.from("questions").insert({ user_id: ids.student, body: "자문자답", answer: "답" })).error).not.toBeNull();

    // 학생은 답변을 쓸 수 없다 (본인 질문이어도)
    await student.from("questions").update({ answer: "셀프 답변", answered_at: new Date().toISOString() }).eq("id", q!.id);
    await student2.from("questions").update({ body: "남의 질문 수정" }).eq("id", q!.id);
    let row = (await service.from("questions").select("body, answer").eq("id", q!.id).single()).data;
    expect(row).toEqual({ body: `RLS-${tag} 회비는 얼마인가요?`, answer: null });

    // 다른 학생도 질문은 볼 수 있지만 작성자 이름은 볼 수 없다
    const { data: seen } = await student2.from("questions").select("id, author:profiles!questions_user_id_fkey(name)").eq("id", q!.id).single();
    expect(seen?.id).toBe(q!.id);
    expect(seen?.author).toBeNull();
    // 비로그인은 볼 수 없다
    expect((await anon.from("questions").select("id").eq("id", q!.id)).data ?? []).toHaveLength(0);

    // 관리자가 답변하면, 학생은 더 이상 지울 수 없다
    expect((await admin.from("questions").update({ answer: "1만원입니다", answered_by: ids.admin, answered_at: new Date().toISOString() }).eq("id", q!.id)).error).toBeNull();
    await student.from("questions").delete().eq("id", q!.id);
    row = (await service.from("questions").select("body, answer").eq("id", q!.id).single()).data;
    expect(row?.answer).toBe("1만원입니다");

    // 관리자는 지울 수 있다
    expect((await admin.from("questions").delete().eq("id", q!.id).select("id")).data).toHaveLength(1);
  });

  it("가입 메타데이터로 권한이나 승인 상태를 얻을 수 없다", async () => {
    const { data, error } = await service.auth.admin.createUser({
      email: `rls-hacker-${tag}@caialender.test`,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: "해커", student_no: studentNo(8), grade: "1", role: "super_admin", approval_status: "approved" },
    });
    expect(error).toBeNull();
    ids.hacker = data.user!.id;
    const { data: p } = await service.from("profiles").select("role, approval_status").eq("id", ids.hacker).single();
    expect(p).toEqual({ role: "student", approval_status: "pending" });
  });

  it("학번은 중복 가입할 수 없다", async () => {
    const { data: s } = await service.from("profiles").select("student_no").eq("id", ids.student).single();
    const { error } = await service.auth.admin.createUser({
      email: `rls-dup-${tag}@caialender.test`,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: "중복", student_no: s!.student_no, grade: "1" },
    });
    expect(error).not.toBeNull();
  });

  it("승인 대기 회원은 본인 프로필만 보고, 서비스 데이터에는 접근할 수 없다", async () => {
    const { data: me } = await pendingUser.from("profiles").select("approval_status").eq("id", ids.pending).single();
    expect(me?.approval_status).toBe("pending");
    expect((await pendingUser.from("events").select("id")).data).toEqual([]);
    expect((await pendingUser.from("notices").select("id")).data).toEqual([]);
    expect((await pendingUser.from("questions").select("id")).data).toEqual([]);
    expect((await pendingUser.from("briefings").select("id")).data).toEqual([]);
    expect((await pendingUser.from("questions").insert({ user_id: ids.pending, body: "승인 전 질문" })).error).not.toBeNull();
    const start = new Date().toISOString();
    expect((await pendingUser.from("personal_events").insert({ title: "x", start_at: start, end_at: start })).error).not.toBeNull();
    // 스스로 승인하거나 권한을 올릴 수 없다
    expect((await pendingUser.from("profiles").update({ approval_status: "approved" }).eq("id", ids.pending)).error).not.toBeNull();
    expect((await pendingUser.rpc("set_approval", { p_user: ids.pending, p_status: "approved" })).error).not.toBeNull();
    const { data: after } = await service.from("profiles").select("role, approval_status").eq("id", ids.pending).single();
    expect(after).toEqual({ role: "student", approval_status: "pending" });
  });

  it("가입 승인·거절: 관리자는 학생을 처리하고, 총관리자·다른 관리자는 건드릴 수 없다", async () => {
    const status = async (id: string) => (await service.from("profiles").select("approval_status").eq("id", id).single()).data?.approval_status;

    // 학생은 승인할 수 없다
    expect((await student.rpc("set_approval", { p_user: ids.pending, p_status: "approved" })).error).not.toBeNull();
    expect(await status(ids.pending)).toBe("pending");

    // 관리자는 거절·승인할 수 있다
    expect((await admin.rpc("set_approval", { p_user: ids.pending, p_status: "rejected" })).error).toBeNull();
    expect(await status(ids.pending)).toBe("rejected");
    expect((await admin.rpc("set_approval", { p_user: ids.pending, p_status: "approved" })).error).toBeNull();
    expect(await status(ids.pending)).toBe("approved");
    // 승인되면 바로 서비스 데이터가 보인다
    expect((await pendingUser.from("events").select("id").eq("id", ids.event)).data).toHaveLength(1);

    // 관리자는 총관리자·다른 관리자의 상태를 바꿀 수 없고, 역할도 바꿀 수 없다
    expect((await admin.rpc("set_approval", { p_user: ids.super, p_status: "rejected" })).error).not.toBeNull();
    expect((await admin.rpc("set_user_role", { p_user: ids.super, p_role: "student" })).error).not.toBeNull();
    expect((await admin.from("profiles").update({ role: "student", approval_status: "rejected" }).eq("id", ids.super)).error).not.toBeNull();
    const { data: sup } = await service.from("profiles").select("role, approval_status").eq("id", ids.super).single();
    expect(sup).toEqual({ role: "super_admin", approval_status: "approved" });

    // 총관리자도 자기 자신이나 다른 총관리자는 바꿀 수 없다
    expect((await superAdmin.rpc("set_approval", { p_user: ids.super, p_status: "rejected" })).error).not.toBeNull();
  });

  it("관리자 임명은 승인된 회원에게만", async () => {
    // hacker 계정은 승인 대기
    expect((await superAdmin.rpc("set_user_role", { p_user: ids.hacker, p_role: "admin" })).error).not.toBeNull();
    const { data } = await service.from("profiles").select("role").eq("id", ids.hacker).single();
    expect(data?.role).toBe("student");
  });

  it("시간표·알림 설정·알림 기기는 본인 것만, 보낸 알림 기록은 서버만", async () => {
    const { data: course, error } = await student
      .from("timetable_courses")
      .insert({ user_id: ids.student, name: `RLS-${tag} 동역학`, professor: "교수" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect((await student.from("timetable_slots").insert({ course_id: course!.id, user_id: ids.student, day: 0, start_min: 540, end_min: 615 })).error).toBeNull();
    // 남의 과목에 시간 칸을 끼워 넣을 수 없다
    expect((await student2.from("timetable_slots").insert({ course_id: course!.id, user_id: ids.student2, day: 1, start_min: 540, end_min: 600 })).error).not.toBeNull();
    expect((await student2.from("timetable_courses").select("id").eq("id", course!.id)).data).toEqual([]);
    await student2.from("timetable_courses").update({ name: "hacked" }).eq("id", course!.id);
    expect((await service.from("timetable_courses").select("name").eq("id", course!.id).single()).data?.name).toBe(`RLS-${tag} 동역학`);

    expect((await student.from("event_reminders").insert({ user_id: ids.student, target_type: "event", target_id: ids.event })).error).toBeNull();
    expect((await student2.from("event_reminders").select("*")).data).toEqual([]);
    expect((await student.from("event_reminders").insert({ user_id: ids.student2, target_type: "event", target_id: ids.event })).error).not.toBeNull();

    const endpoint = `https://push.example.test/${tag}`;
    expect((await student.from("push_subscriptions").insert({ user_id: ids.student, endpoint, p256dh: "k", auth: "a" })).error).toBeNull();
    expect((await student2.from("push_subscriptions").select("id").eq("endpoint", endpoint)).data).toEqual([]);

    // 보낸 알림 기록은 학생이 읽거나 쓸 수 없다
    expect((await student.from("notification_log").insert({ user_id: ids.student, key: "x" })).error).not.toBeNull();
    expect((await student.from("notification_log").select("*")).data ?? []).toEqual([]);

    // 승인 대기 회원은 시간표를 만들 수 없다 (hacker 계정은 승인 대기)
    const hacker = await signIn(`rls-hacker-${tag}@caialender.test`);
    expect((await hacker.from("timetable_courses").insert({ user_id: ids.hacker, name: "x" })).error).not.toBeNull();

    await service.from("push_subscriptions").delete().eq("endpoint", endpoint);
  });

  describe("학년별 소통방", () => {
    const nick = (k: string) => `t${k}${tag}`.slice(0, 12);
    let msgId: number;
    let s1Member: string;

    it("승인 대기 회원은 닉네임을 만들 수 없다", async () => {
      // (pending 계정은 위 승인 테스트에서 승인되므로, 여전히 승인 대기인 hacker 계정으로 확인)
      const waiting = await signIn(`rls-hacker-${tag}@caialender.test`);
      const { error } = await waiting.rpc("set_chat_nickname", { p_nickname: nick("p") });
      expect(error).not.toBeNull();
    });

    it("닉네임은 겹칠 수 없고, 내 닉네임으로만 글을 쓴다", async () => {
      expect((await student.rpc("set_chat_nickname", { p_nickname: nick("a") })).error).toBeNull();
      expect((await student2.rpc("set_chat_nickname", { p_nickname: nick("a").toUpperCase() })).error).not.toBeNull();
      expect((await student2.rpc("set_chat_nickname", { p_nickname: nick("b") })).error).toBeNull();
      expect((await admin.rpc("set_chat_nickname", { p_nickname: nick("c") })).error).toBeNull();
      s1Member = ((await student.rpc("my_chat_member")).data as { id: string }[])[0].id;
      const s2Member = ((await student2.rpc("my_chat_member")).data as { id: string }[])[0].id;
      const ins = await student.from("chat_messages").insert({ room: 2, member_id: s1Member, body: `RLS-${tag} 안녕` }).select("id").single();
      expect(ins.error).toBeNull();
      msgId = ins.data!.id;
      // 다른 학생의 닉네임으로는 못 쓴다
      expect((await student.from("chat_messages").insert({ room: 2, member_id: s2Member, body: "사칭" })).error).not.toBeNull();
    });

    it("학생은 닉네임만 볼 수 있고, 계정 id·실명은 볼 수 없다", async () => {
      const msgs = await student2.from("chat_messages").select("id, body, author:chat_members!chat_messages_member_id_fkey(nickname)").eq("id", msgId).single();
      expect(msgs.data).toMatchObject({ body: `RLS-${tag} 안녕`, author: { nickname: nick("a") } });
      expect((await student2.from("chat_members").select("user_id")).error).not.toBeNull();
      expect((await student2.from("chat_members").select("warnings")).error).not.toBeNull();
      const who = await student2.rpc("chat_member_identities", { p_members: [s1Member] });
      expect(who.data).toEqual([]);
    });

    it("관리자는 닉네임의 실제 회원을 확인한다", async () => {
      const who = await admin.rpc("chat_member_identities", { p_members: [s1Member] });
      expect(who.data).toEqual([expect.objectContaining({ id: s1Member, name: "테스트student", warnings: 0 })]);
    });

    it("학생은 삭제·경고를 못 하고, 관리자 경고 3번이면 글을 쓸 수 없다", async () => {
      expect((await student2.rpc("chat_delete_message", { p_message: msgId })).error).not.toBeNull();
      expect((await student2.rpc("chat_warn", { p_message: msgId, p_reason: "x" })).error).not.toBeNull();
      const w1 = await admin.rpc("chat_warn", { p_message: msgId, p_reason: "욕설·비방", p_delete: true });
      expect(w1.data).toEqual([{ user_id: ids.student, warnings: 1 }]);
      // 삭제하면 내용까지 지워진다
      const gone = await student2.from("chat_messages").select("body, deleted_at").eq("id", msgId).single();
      expect(gone.data!.body).toBe("");
      expect(gone.data!.deleted_at).not.toBeNull();
      // 본인은 자기 경고 사유를 본다, 다른 학생은 못 본다
      expect((await student.from("chat_warnings").select("reason")).data).toEqual([{ reason: "욕설·비방" }]);
      expect((await student2.from("chat_warnings").select("reason")).data).toEqual([]);
      for (let i = 2; i <= 3; i++) {
        const m = await student.from("chat_messages").insert({ room: 1, member_id: s1Member, body: `RLS-${tag} ${i}` }).select("id").single();
        expect(m.error).toBeNull();
        expect((await admin.rpc("chat_warn", { p_message: m.data!.id, p_reason: "도배" })).data).toEqual([{ user_id: ids.student, warnings: i }]);
      }
      const banned = await student.from("chat_messages").insert({ room: 1, member_id: s1Member, body: "제한 후" });
      expect(banned.error).not.toBeNull();
      // 경고 3회면 소통방 메시지도 읽을 수 없고 닉네임도 못 바꾼다 (관리자는 계속 본다)
      expect((await student.from("chat_messages").select("id")).data).toEqual([]);
      expect((await student.rpc("set_chat_nickname", { p_nickname: nick("z") })).error).not.toBeNull();
      expect(((await admin.from("chat_messages").select("id").eq("id", msgId)).data ?? []).length).toBe(1);
      // 관리자가 초기화하면 다시 쓸 수 있다
      expect((await admin.rpc("chat_reset_warnings", { p_member: s1Member })).error).toBeNull();
      expect((await student.from("chat_messages").insert({ room: 1, member_id: s1Member, body: `RLS-${tag} 복귀` })).error).toBeNull();
    });

    it("본인 메시지만 지울 수 있고(경고받은 건 못 지움), 원래 내용은 관리자만 본다", async () => {
      const mine = await student.from("chat_messages").insert({ room: 3, member_id: s1Member, body: `RLS-${tag} 실수` }).select("id").single();
      // 다른 학생은 못 지운다
      expect((await student2.rpc("chat_delete_own", { p_message: mine.data!.id })).error).not.toBeNull();
      expect((await student.rpc("chat_delete_own", { p_message: mine.data!.id })).error).toBeNull();
      const seen = await student2.from("chat_messages").select("body, deleted_self").eq("id", mine.data!.id).single();
      expect(seen.data).toEqual({ body: "", deleted_self: true });
      // 학생은 원래 내용 칸을 읽을 수 없고, 관리자 함수도 빈 결과
      expect((await student2.from("chat_messages").select("deleted_body")).error).not.toBeNull();
      expect((await student2.rpc("chat_deleted_bodies", { p_messages: [mine.data!.id] })).data).toEqual([]);
      expect((await admin.rpc("chat_deleted_bodies", { p_messages: [mine.data!.id] })).data).toEqual([{ id: mine.data!.id, body: `RLS-${tag} 실수` }]);
      // 경고받은 메시지(msgId)는 본인이 지울 수 없다
      const warned = await student.from("chat_messages").insert({ room: 3, member_id: s1Member, body: `RLS-${tag} 문제글` }).select("id").single();
      await admin.rpc("chat_warn", { p_message: warned.data!.id, p_reason: "테스트", p_delete: false });
      expect((await student.rpc("chat_delete_own", { p_message: warned.data!.id })).error).not.toBeNull();
      await admin.rpc("chat_reset_warnings", { p_member: s1Member });
    });

    it("관리자 멤버 관리: 실제 회원·활동 목록, 직접 경고·이용 제한, 닉네임 변경 기록", async () => {
      expect((await student.rpc("chat_admin_members")).data).toEqual([]);
      const list = (await admin.rpc("chat_admin_members")).data as { id: string; name: string; message_count: number }[];
      expect(list.find((m) => m.id === s1Member)).toMatchObject({ name: "테스트student" });
      expect(Number(list.find((m) => m.id === s1Member)!.message_count)).toBeGreaterThan(0);
      // 학생은 직접 경고 못 함, 관리자는 바로 이용 제한
      expect((await student2.rpc("chat_warn_member", { p_member: s1Member, p_reason: "x" })).error).not.toBeNull();
      const ban = await admin.rpc("chat_warn_member", { p_member: s1Member, p_reason: "운영 정책 위반", p_ban: true });
      expect(ban.data).toEqual([{ user_id: ids.student, warnings: 3 }]);
      expect((await student.from("chat_messages").insert({ room: 1, member_id: s1Member, body: "제한" })).error).not.toBeNull();
      await admin.rpc("chat_reset_warnings", { p_member: s1Member });
      // 닉네임을 바꾸면 기록이 남고, 관리자만 본다
      expect((await student2.rpc("set_chat_nickname", { p_nickname: nick("n") })).error).toBeNull();
      const s2 = ((await student2.rpc("my_chat_member")).data as { id: string }[])[0].id;
      const hist = await admin.from("chat_nickname_history").select("old_nickname, new_nickname").eq("member_id", s2);
      expect(hist.data).toEqual([{ old_nickname: nick("b"), new_nickname: nick("n") }]);
      expect((await student2.from("chat_nickname_history").select("id")).data).toEqual([]);
    });
  });
});

