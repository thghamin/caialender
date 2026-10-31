"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { isAdminRole } from "@/lib/types";
import {
  CHAT_BAN_WARNINGS,
  CHAT_MAX_LENGTH,
  isBanned,
  nicknameError,
  parseRoom,
  reportMessage,
  roomAlertMessage,
  STAFF_MEMBER_ID,
  warningMessage,
  type ChatIdentity,
  type ChatMember,
  type ChatMessage,
} from "@/lib/chat";

type Result = { error?: string };
/** 방에 들어갈 때·이전 대화 더 보기 한 번에 받는 메시지 수 */
const CHAT_PAGE = 50;

/** 내 소통방 정보 (닉네임 없으면 null). 한 화면을 그리는 동안은 한 번만 조회한다 */
const myChatMember = cache(async (): Promise<ChatMember | null> => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_chat_member");
  const row = (data as ChatMember[] | null)?.[0];
  return row ?? null;
});
export async function getMyChatMember(): Promise<ChatMember | null> {
  return myChatMember();
}

/** 닉네임을 쓸 수 있는지 (형식 + 다른 사람과 겹치는지, 대소문자 구분 없이). 지금 내 닉네임은 쓸 수 있다 */
export async function checkNickname(nickname: string): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  const v = nickname.trim();
  const err = nicknameError(v);
  if (err) return { ok: false, message: err };
  const supabase = await createClient();
  // ilike에서 _ 와 % 는 와일드카드이므로 그대로 비교되게 바꾼다
  const pattern = v.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [{ data: same }, me] = await Promise.all([
    supabase.from("chat_members").select("id").ilike("nickname", pattern).limit(1),
    getMyChatMember(),
  ]);
  const taken = (same ?? []).some((r) => r.id !== me?.id);
  if (taken) return { ok: false, message: "이미 쓰는 닉네임이에요." };
  if (me && me.nickname === v) return { ok: true, message: "지금 쓰고 있는 닉네임이에요." };
  return { ok: true, message: "사용할 수 있는 닉네임이에요." };
}

export async function setNickname(nickname: string): Promise<Result> {
  await requireUser();
  const err = nicknameError(nickname);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_chat_nickname", { p_nickname: nickname.trim() });
  if (error) return { error: error.message.includes("이미") ? "이미 쓰는 닉네임이에요." : error.message };
  revalidatePath("/chat", "layout");
  return {};
}

const SELECT =
  "id, room, body, created_at, deleted_at, deleted_self, reply_to, author:chat_members!chat_messages_member_id_fkey(id, nickname), " +
  "reply:reply_to(id, body, deleted_at, author:chat_members!chat_messages_member_id_fkey(nickname))";
type ReplyRow = { id: number; body: string; deleted_at: string | null; author: { nickname: string } } | null;
type Row = { id: number; room: number; body: string; created_at: string; deleted_at: string | null; deleted_self: boolean; reply: ReplyRow; author: { id: string; nickname: string } };
// '학생회' 표시는 공용 학생회 작성자일 때만 (관리자 개인 닉네임에는 붙이지 않는다)
const withStaff = (a: Row["author"]) => ({ ...a, staff: a.id === STAFF_MEMBER_ID });

const toReply = (r: ReplyRow) =>
  r ? { id: r.id, nickname: r.author.nickname, body: r.deleted_at ? "" : r.body, deleted: !!r.deleted_at } : null;

/**
 * 방의 메시지. afterId를 주면 그 뒤에 온 것만(새 메시지 확인용), beforeId를 주면 그 앞의 50개(이전 대화 더 보기),
 * 아니면 최근 50개. 관리자에게는 닉네임의 실제 회원(이름·학번·학년·경고 수)을 함께 준다.
 */
export async function getChatMessages(roomRaw: number, afterId?: number, beforeId?: number): Promise<ChatMessage[]> {
  const me = await requireUser();
  const room = parseRoom(roomRaw);
  if (!room) return [];
  const supabase = await createClient();
  let q = supabase.from("chat_messages").select(SELECT).eq("room", room);
  if (afterId) q = q.gt("id", afterId).order("id").limit(200);
  else if (beforeId) q = q.lt("id", beforeId).order("id", { ascending: false }).limit(CHAT_PAGE);
  else q = q.order("id", { ascending: false }).limit(CHAT_PAGE);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => a.id - b.id);

  let identities = new Map<string, ChatIdentity>();
  let originals = new Map<number, string>();
  if (isAdminRole(me.role) && rows.length) {
    const ids = [...new Set(rows.map((r) => r.author.id))];
    const deletedIds = rows.filter((r) => r.deleted_at).map((r) => r.id);
    const [{ data: who }, { data: bodies }] = await Promise.all([
      supabase.rpc("chat_member_identities", { p_members: ids }),
      deletedIds.length ? supabase.rpc("chat_deleted_bodies", { p_messages: deletedIds }) : Promise.resolve({ data: [] }),
    ]);
    identities = new Map(((who ?? []) as (ChatIdentity & { id: string })[]).map(({ id, ...rest }) => [id, rest]));
    originals = new Map(((bodies ?? []) as { id: number; body: string }[]).map((b) => [b.id, b.body]));
  }
  return rows.map((r) => ({
    id: r.id,
    room,
    body: r.deleted_at ? "" : r.body,
    created_at: r.created_at,
    deleted: !!r.deleted_at,
    deletedSelf: r.deleted_self,
    originalBody: originals.get(r.id),
    reply: toReply(r.reply),
    author: withStaff(r.author),
    identity: identities.get(r.author.id),
  }));
}

export async function sendChatMessage(roomRaw: number, body: string, replyTo?: number, asStaff = false): Promise<Result & { message?: ChatMessage }> {
  const me = await requireUser();
  const room = parseRoom(roomRaw);
  const text = body.trim();
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (!text) return { error: "메시지를 입력하세요." };
  if (text.length > CHAT_MAX_LENGTH) return { error: `메시지는 ${CHAT_MAX_LENGTH}자까지 쓸 수 있어요.` };
  const member = await getMyChatMember();
  if (!member) return { error: "먼저 닉네임을 정해 주세요." };
  if (isBanned(member)) return { error: "경고 3회 누적으로 소통방을 더 이상 이용할 수 없어요." };
  const supabase = await createClient();
  let data: unknown = null;
  let error: { message: string } | null = null;
  if (asStaff) {
    // 관리자: 공용 '학생회' 이름으로 (누가 보냈는지는 학생에게 보이지 않는다)
    if (!isAdminRole(me.role)) return { error: "관리자만 학생회 이름으로 보낼 수 있어요." };
    const posted = await supabase.rpc("chat_post_as_staff", { p_room: room, p_body: text, p_reply: replyTo ?? null });
    error = posted.error;
    if (!error) ({ data, error } = await supabase.from("chat_messages").select(SELECT).eq("id", posted.data as number).single());
  } else {
    ({ data, error } = await supabase.from("chat_messages").insert({ room, member_id: member.id, body: text, reply_to: replyTo ?? null }).select(SELECT).single());
  }
  if (error || !data) return { error: error?.message.includes("같은 방") ? error.message : "메시지를 보내지 못했어요. 잠시 후 다시 해 주세요." };
  const r = data as unknown as Row;
  // 이 방 알림을 켠 사람들에게 (보낸 사람·이용 제한된 사람 제외)
  if (pushConfigured()) {
    const msg = roomAlertMessage(room, asStaff ? "학생회" : member.nickname, text);
    after(async () => {
      const db = createServiceClient();
      const [{ data: subs }, { data: banned }] = await Promise.all([
        db.from("chat_room_alerts").select("user_id").eq("room", room).neq("user_id", me.id),
        db.from("chat_members").select("user_id").gte("warnings", CHAT_BAN_WARNINGS),
      ]);
      const skip = new Set((banned ?? []).map((b) => b.user_id));
      await Promise.all((subs ?? []).filter((x) => !skip.has(x.user_id)).map((x) => sendPushToUser(x.user_id, msg).catch(() => {})));
    });
  }
  return {
    message: { id: r.id, room, body: r.body, created_at: r.created_at, deleted: false, deletedSelf: false, author: withStaff(r.author), reply: toReply(r.reply) },
  };
}

/** 소통방 알림을 켠 방 목록 (기본은 모두 꺼짐) */
export async function getMyRoomAlerts(): Promise<number[]> {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("chat_room_alerts").select("room").eq("user_id", me.id);
  return (data ?? []).map((r) => r.room);
}

/** 방 알림 켜기·끄기 */
export async function setRoomAlert(roomRaw: number, on: boolean): Promise<Result> {
  const me = await requireUser();
  const room = parseRoom(roomRaw);
  if (!room) return { error: "방을 찾을 수 없어요." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("chat_room_alerts").upsert({ user_id: me.id, room }, { onConflict: "user_id,room", ignoreDuplicates: true })
    : await supabase.from("chat_room_alerts").delete().eq("user_id", me.id).eq("room", room);
  return error ? { error: "알림 설정을 바꾸지 못했어요." } : {};
}

/** 본인 메시지 삭제 (경고받은 메시지는 안 됨) */
export async function deleteOwnChatMessage(id: number): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_delete_own", { p_message: id });
  if (!error) return {};
  return { error: error.message.includes("경고") ? "경고받은 메시지는 지울 수 없어요." : "지우지 못했어요." };
}

/** 관리자: 메시지 삭제 */
export async function deleteChatMessage(id: number): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_delete_message", { p_message: id });
  return error ? { error: "삭제하지 못했어요." } : {};
}

/** 관리자: 작성자에게 경고 (메시지도 삭제). 경고받은 학생에게 알림 */
export async function warnChatAuthor(id: number, reason: string): Promise<Result & { warnings?: number }> {
  await requireAdmin();
  const why = reason.trim();
  if (!why) return { error: "경고 사유를 적어 주세요." };
  if (why.length > 200) return { error: "사유는 200자까지 쓸 수 있어요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_warn", { p_message: id, p_reason: why, p_delete: true });
  const row = (data as { user_id: string; warnings: number }[] | null)?.[0];
  if (error || !row) return { error: "경고하지 못했어요." };
  if (pushConfigured()) {
    const msg = warningMessage(row.warnings, why);
    after(() => sendPushToUser(row.user_id, { ...msg, tag: `chat-warn:${id}` }).catch(() => {}));
  }
  return { warnings: row.warnings };
}

/** 관리자: 경고 초기화 (이용 제한 풀기) */
export async function resetChatWarnings(memberId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_reset_warnings", { p_member: memberId });
  revalidatePath("/chat/members");
  return error ? { error: "초기화하지 못했어요." } : {};
}

/** 내가 받은 경고 목록 (사유·시각) */
export async function getMyWarnings(): Promise<{ reason: string; created_at: string }[]> {
  const member = await getMyChatMember();
  if (!member || member.warnings === 0) return []; // 경고가 없으면 조회하지 않는다
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_warnings")
    .select("reason, created_at")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export type ChatAdminMember = {
  id: string;
  nickname: string;
  staff: boolean;
  warnings: number;
  name: string;
  student_no: string | null;
  grade: number | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  history: { reason: string; created_at: string }[];
  /** 닉네임 변경 기록 (최근 순) */
  nicknames: { old_nickname: string; new_nickname: string; changed_at: string }[];
};

/** 관리자: 소통방 멤버 목록 (경고 많은 순 → 최근 활동 순) + 경고 기록 */
export async function getChatAdminMembers(): Promise<ChatAdminMember[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: members }, { data: history }, { data: renames }] = await Promise.all([
    supabase.rpc("chat_admin_members"),
    supabase.from("chat_warnings").select("member_id, reason, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("chat_nickname_history").select("member_id, old_nickname, new_nickname, changed_at").order("changed_at", { ascending: false }).limit(500),
  ]);
  const renamed = new Map<string, ChatAdminMember["nicknames"]>();
  for (const r of renames ?? []) renamed.set(r.member_id, [...(renamed.get(r.member_id) ?? []), { old_nickname: r.old_nickname, new_nickname: r.new_nickname, changed_at: r.changed_at }]);
  const byMember = new Map<string, { reason: string; created_at: string }[]>();
  for (const h of history ?? []) byMember.set(h.member_id, [...(byMember.get(h.member_id) ?? []), { reason: h.reason, created_at: h.created_at }]);
  return ((members ?? []) as Omit<ChatAdminMember, "history">[]).map((m) => ({ ...m, message_count: Number(m.message_count), history: byMember.get(m.id) ?? [], nicknames: renamed.get(m.id) ?? [] }));
}

/** 관리자: 멤버에게 직접 경고 (ban이면 바로 이용 제한). 알림을 보낸다 */
export async function warnChatMember(memberId: string, reason: string, ban = false): Promise<Result & { warnings?: number }> {
  await requireAdmin();
  const why = reason.trim();
  if (!why) return { error: "사유를 적어 주세요." };
  if (why.length > 200) return { error: "사유는 200자까지 쓸 수 있어요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_warn_member", { p_member: memberId, p_reason: why, p_ban: ban });
  const row = (data as { user_id: string; warnings: number }[] | null)?.[0];
  if (error || !row) return { error: "처리하지 못했어요." };
  if (pushConfigured()) {
    const msg = warningMessage(row.warnings, why);
    after(() => sendPushToUser(row.user_id, { ...msg, tag: `chat-warn-member:${memberId}:${row.warnings}` }).catch(() => {}));
  }
  revalidatePath("/chat/members");
  return { warnings: row.warnings };
}

/** 학생: 다른 학생의 메시지 신고 → 관리자 전원에게 알림 */
export async function reportChatMessage(id: number, room: number, reason: string): Promise<Result> {
  await requireUser();
  const why = reason.trim();
  if (!why) return { error: "신고 사유를 골라 주세요." };
  if (why.length > 200) return { error: "사유는 200자까지 쓸 수 있어요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_report", { p_message: id, p_reason: why });
  if (error) {
    const known = ["이미 신고한", "내 메시지는", "신고할 수 없는", "닉네임을", "이용할 수 없어요", "학생회 공지"].find((k) => error.message.includes(k));
    return { error: known ? error.message : "신고하지 못했어요. 잠시 후 다시 해 주세요." };
  }
  if (pushConfigured()) {
    const msg = reportMessage(parseRoom(room) ?? room, why);
    after(async () => {
      // 관리자 목록은 학생 권한으로 못 보므로 서버에서만 조회
      const db = createServiceClient();
      const { data: admins } = await db.from("profiles").select("id").in("role", ["admin", "super_admin"]).eq("approval_status", "approved");
      await Promise.all((admins ?? []).map((a) => sendPushToUser(a.id, { ...msg, tag: `chat-report:${id}` }).catch(() => {})));
    });
  }
  return {};
}

export type ChatReport = {
  id: number;
  status: "open" | "resolved" | "dismissed";
  reason: string;
  created_at: string;
  message_id: number;
  room: number;
  body: string;
  message_deleted: boolean;
  message_at: string;
  author_id: string;
  author_nickname: string;
  author_name: string;
  author_warnings: number;
  reporter_nickname: string;
  reporter_name: string;
  report_count: number;
};

/** 관리자: 신고 목록 */
export async function getChatReports(openOnly = true): Promise<ChatReport[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_admin_reports", { p_open_only: openOnly });
  return ((data ?? []) as ChatReport[]).map((r) => ({ ...r, report_count: Number(r.report_count) }));
}

/** 관리자: 처리 안 한 신고 수 (관리자가 아니면 0) */
export async function getOpenReportCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_open_report_count");
  return Number(data ?? 0);
}

/** 관리자: 신고 처리 — 경고하고 삭제 / 삭제만 / 문제없음 */
export async function handleChatReport(messageId: number, action: "warn" | "delete" | "dismiss", reason = ""): Promise<Result> {
  await requireAdmin();
  if (action === "warn") {
    const r = await warnChatAuthor(messageId, reason);
    if (r.error) return r;
  } else if (action === "delete") {
    const r = await deleteChatMessage(messageId);
    if (r.error) return r;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_handle_reports", { p_message: messageId, p_status: action === "dismiss" ? "dismissed" : "resolved" });
  revalidatePath("/chat/reports");
  return error ? { error: "처리 상태를 저장하지 못했어요." } : {};
}

/** 아직 확인하지 않은 내 경고 (확인한 마지막 경고 번호는 로그인 계정 정보에 저장 → 다른 기기에서도 다시 안 뜬다) */
export async function getUnseenWarnings(): Promise<{ total: number; items: { id: number; reason: string; created_at: string }[] }> {
  const member = await getMyChatMember();
  if (!member || member.warnings === 0) return { total: member?.warnings ?? 0, items: [] };
  const supabase = await createClient();
  // 경고가 있을 때만 오는 드문 호출이라, 방금 확인한 기록까지 정확히 보도록 로그인 서버에서 최신 계정 정보를 읽는다
  const { data: u } = await supabase.auth.getUser();
  const seen = Number((u.user?.user_metadata as { chat_warn_seen?: number } | undefined)?.chat_warn_seen ?? 0);
  const { data } = await supabase
    .from("chat_warnings")
    .select("id, reason, created_at")
    .eq("member_id", member.id)
    .gt("id", seen)
    .order("id", { ascending: false })
    .limit(5);
  return { total: member.warnings, items: data ?? [] };
}

/** 경고 팝업 '확인': 이 번호까지 봤다고 계정에 기록 */
export async function ackWarnings(lastId: number): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { chat_warn_seen: lastId } });
  if (!error) await supabase.auth.refreshSession();
}
