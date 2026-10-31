"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUser } from "@/lib/push";
import { isAdminRole } from "@/lib/types";
import {
  CHAT_MAX_LENGTH,
  isBanned,
  nicknameError,
  parseRoom,
  warningMessage,
  type ChatIdentity,
  type ChatMember,
  type ChatMessage,
} from "@/lib/chat";

type Result = { error?: string };

/** 내 소통방 정보 (닉네임 없으면 null) */
export async function getMyChatMember(): Promise<ChatMember | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_chat_member");
  const row = (data as ChatMember[] | null)?.[0];
  return row ?? null;
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

const SELECT = "id, room, body, created_at, deleted_at, deleted_self, author:chat_members!chat_messages_member_id_fkey(id, nickname, staff)";
type Row = { id: number; room: number; body: string; created_at: string; deleted_at: string | null; deleted_self: boolean; author: { id: string; nickname: string; staff: boolean } };

/**
 * 방의 메시지. afterId를 주면 그 뒤에 온 것만(새 메시지 확인용), 아니면 최근 100개.
 * 관리자에게는 닉네임의 실제 회원(이름·학번·학년·경고 수)을 함께 준다.
 */
export async function getChatMessages(roomRaw: number, afterId?: number): Promise<ChatMessage[]> {
  const me = await requireUser();
  const room = parseRoom(roomRaw);
  if (!room) return [];
  const supabase = await createClient();
  let q = supabase.from("chat_messages").select(SELECT).eq("room", room);
  q = afterId ? q.gt("id", afterId).order("id").limit(200) : q.order("id", { ascending: false }).limit(100);
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
    author: r.author,
    identity: identities.get(r.author.id),
  }));
}

export async function sendChatMessage(roomRaw: number, body: string): Promise<Result & { message?: ChatMessage }> {
  await requireUser();
  const room = parseRoom(roomRaw);
  const text = body.trim();
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (!text) return { error: "메시지를 입력하세요." };
  if (text.length > CHAT_MAX_LENGTH) return { error: `메시지는 ${CHAT_MAX_LENGTH}자까지 쓸 수 있어요.` };
  const member = await getMyChatMember();
  if (!member) return { error: "먼저 닉네임을 정해 주세요." };
  if (isBanned(member)) return { error: "경고 3회 누적으로 소통방을 더 이상 이용할 수 없어요." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ room, member_id: member.id, body: text })
    .select(SELECT)
    .single();
  if (error || !data) return { error: "메시지를 보내지 못했어요. 잠시 후 다시 해 주세요." };
  const r = data as unknown as Row;
  return { message: { id: r.id, room, body: r.body, created_at: r.created_at, deleted: false, deletedSelf: false, author: r.author } };
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
  if (!member) return [];
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
