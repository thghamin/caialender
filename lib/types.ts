export type Role = "student" | "admin";

export type Profile = {
  id: string;
  name: string;
  student_no: string | null;
  grade: number | null;
  role: Role;
};

export type EventKind = "event" | "deadline" | "other";
export type EventStatus = "draft" | "published" | "archived";

export type CalendarEvent = {
  id: string;
  notice_id: string | null;
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
