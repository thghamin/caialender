// 학년별 소통방: 공용 타입·규칙 (순수 함수, 테스트 대상)

export const CHAT_ROOMS = [1, 2, 3, 4] as const;
export type ChatRoom = (typeof CHAT_ROOMS)[number];
/** 경고를 이만큼 받으면 소통방에 글을 쓸 수 없다 (DB의 chat_can_post와 같은 기준) */
export const CHAT_BAN_WARNINGS = 3;
export const CHAT_MAX_LENGTH = 500;
/** 관리자가 '학생회' 공식 이름으로 보낼 때 쓰는 공용 작성자 (DB에 고정) */
export const STAFF_MEMBER_ID = "00000000-0000-0000-0000-00000000c0de";

export type ChatMember = { id: string; nickname: string; staff: boolean; warnings: number };
/** 관리자에게만 보이는 실제 회원 정보 */
export type ChatIdentity = { name: string; student_no: string | null; grade: number | null; warnings: number };
export type ChatMessage = {
  id: number;
  room: ChatRoom;
  body: string;
  created_at: string;
  deleted: boolean;
  /** 본인이 지웠는지 (아니면 관리자 삭제) */
  deletedSelf: boolean;
  /** 관리자일 때만: 지워진 메시지의 원래 내용 */
  originalBody?: string;
  author: { id: string; nickname: string; staff: boolean };
  /** 답장한 원래 메시지 (요약) */
  reply?: { id: number; nickname: string; body: string; deleted: boolean } | null;
  /** 관리자일 때만 */
  identity?: ChatIdentity;
};

export function parseRoom(v: unknown): ChatRoom | null {
  const n = Number(v);
  return (CHAT_ROOMS as readonly number[]).includes(n) ? (n as ChatRoom) : null;
}

/** 닉네임 규칙: 2~12자, 한글(자음·모음만도 가능)·영문·숫자·밑줄만, 관리자·학생회 사칭 금지 */
export function nicknameError(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 2 || v.length > 12) return "닉네임은 2~12자로 정해 주세요.";
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_]+$/.test(v)) return "닉네임은 한글·영문·숫자·밑줄(_)만 쓸 수 있어요. (띄어쓰기·특수문자 불가)";
  if (/관리자|운영자|학생회|admin/i.test(v)) return "관리자·학생회로 오해할 수 있는 닉네임은 쓸 수 없어요.";
  return null;
}

export function isBanned(m: Pick<ChatMember, "warnings"> | null) {
  return !!m && m.warnings >= CHAT_BAN_WARNINGS;
}

/** 경고 알림 문구 */
export function warningMessage(warnings: number, reason: string) {
  const banned = warnings >= CHAT_BAN_WARNINGS;
  return {
    title: `⚠️ 소통방 경고 ${Math.min(warnings, CHAT_BAN_WARNINGS)}/${CHAT_BAN_WARNINGS}`,
    body: banned
      ? `사유: ${reason} · 경고 ${CHAT_BAN_WARNINGS}회 누적으로 소통방을 더 이상 이용할 수 없어요.`
      : `사유: ${reason} · 경고 ${CHAT_BAN_WARNINGS}회를 받으면 소통방을 쓸 수 없어요.`,
    url: "/chat",
  };
}

export const REPORT_REASONS = ["욕설·비방", "도배", "광고·홍보", "개인정보 노출", "수업과 무관한 글", "기타"] as const;

/** 관리자에게 가는 신고 알림 문구 */
export function reportMessage(room: number, reason: string) {
  return { title: "🚨 소통방 신고가 들어왔어요", body: `${room}학년 소통방 · 사유: ${reason}`, url: "/chat/reports" };
}

/** 소통방 새 메시지 알림 문구 (같은 방 알림은 기기에서 하나로 묶인다) */
export function roomAlertMessage(room: number, nickname: string, body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return { title: `💬 ${room}학년 소통방`, body: `${nickname}: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}`, url: `/chat/${room}`, tag: `chat-room-${room}` };
}
