export type Role = "student" | "admin" | "super_admin";

export const isAdminRole = (role: Role | undefined | null) => role === "admin" || role === "super_admin";

export const ROLE_LABEL: Record<Role, string> = { student: "학생", admin: "학생회 관리자", super_admin: "총관리자" };

export type ApprovalStatus = "pending" | "approved" | "rejected";

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = { pending: "승인 대기", approved: "승인됨", rejected: "거절됨" };

export type Profile = {
  id: string;
  name: string;
  student_no: string | null;
  grade: number | null;
  department: string | null;
  role: Role;
  approval_status: ApprovalStatus;
};

export type EventKind = "event" | "deadline" | "other";
export type EventStatus = "draft" | "published" | "archived";
/** academic: 경북대 학사일정, dept: 학생회가 올리는 학과 일정 */
export type CalendarKind = "academic" | "dept";

export const CALENDAR_LABEL: Record<CalendarKind, string> = { academic: "학사 캘린더", dept: "학과 캘린더" };

export type CalendarEvent = {
  id: string;
  notice_id: string | null;
  calendar: CalendarKind;
  title: string;
  description: string;
  kind: EventKind;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  target_grades: number[];
  target_note: string | null;
  missing_fields: string[];
  status: EventStatus;
  created_at: string;
  updated_at: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  posted_at: string;
  status: "queued" | "processing" | "analyzed" | "failed";
  attempts: number;
  last_error: string | null;
  ai_result: unknown;
  ai_model: string | null;
  analyzed_at: string | null;
  created_at: string;
};

export type PersonalEvent = {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  end_at: string;
  memo: string;
};

export const KIND_LABEL: Record<EventKind, string> = {
  event: "행사",
  deadline: "마감",
  other: "기타",
};
