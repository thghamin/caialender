// 학년별 소통방: 공용 타입·규칙 (순수 함수, 테스트 대상)

export const CHAT_ROOMS = [1, 2, 3, 4] as const;
export type ChatRoom = (typeof CHAT_ROOMS)[number];
/** 경고를 이만큼 받으면 소통방에 글을 쓸 수 없다 (DB의 chat_can_post와 같은 기준) */
export const CHAT_BAN_WARNINGS = 3;
export const CHAT_MAX_LENGTH = 500;

export type ChatMember = { id: string; nickname: string; staff: boolean; warnings: number };
/** 관리자에게만 보이는 실제 회원 정보 */
export type ChatIdentity = { name: string; student_no: string | null; grade: number | null; warnings: number };
export type ChatMessage = {
  id: number;
  room: ChatRoom;
  body: string;
  created_at: string;
  deleted: boolean;
  author: { id: string; nickname: string; staff: boolean };
  /** 관리자일 때만 */
  identity?: ChatIdentity;
};

export function parseRoom(v: unknown): ChatRoom | null {
  const n = Number(v);
  return (CHAT_ROOMS as readonly number[]).includes(n) ? (n as ChatRoom) : null;
}

/** 닉네임 규칙: 2~12자, 한글·영문·숫자·밑줄만, 관리자·학생회 사칭 금지 */
export function nicknameError(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 2 || v.length > 12) return "닉네임은 2~12자로 정해 주세요.";
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(v)) return "닉네임은 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.";
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
      ? `사유: ${reason} · 경고 ${CHAT_BAN_WARNINGS}회로 소통방 이용이 제한되었어요.`
      : `사유: ${reason} · 경고 ${CHAT_BAN_WARNINGS}회를 받으면 소통방을 쓸 수 없어요.`,
    url: "/chat",
  };
}
