"use client";

import { useActionState } from "react";
import { EventTimeFields } from "./event-time-fields";
import { saveEvent } from "@/app/admin/actions";
import { Alert, Button, Field } from "@/components/ui";
import type { CalendarEvent } from "@/lib/types";

export function EventForm({ event, values, defaultCalendar = "dept" }: {
  event?: CalendarEvent;
  values: { start: string; end: string };
  defaultCalendar?: "dept" | "academic";
}) {
  const [state, action, pending] = useActionState(saveEvent, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <Field label="제목" name="title" defaultValue={event?.title} required maxLength={120} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">캘린더</span>
        <select name="calendar" defaultValue={event?.calendar ?? defaultCalendar} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
          <option value="dept">학과 캘린더 (학생회 일정)</option>
          <option value="academic">학사 캘린더 (학교 학사일정)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">종류</span>
        <select name="kind" defaultValue={event?.kind ?? "event"} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
          <option value="event">행사</option>
          <option value="deadline">마감</option>
          <option value="other">기타</option>
        </select>
      </label>
      {/* 날짜는 달력 칸, 시각은 오전/오후·시·분 버튼 (종료는 선택) */}
      <EventTimeFields initial={values} initialAllDay={event?.all_day ?? false} />
      <Field label="장소" name="location" defaultValue={event?.location ?? ""} />
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium text-zinc-700 mb-1">대상 학년 (아무것도 선택하지 않으면 전체)</legend>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((g) => (
            <label key={g} className="flex items-center gap-1">
              <input type="checkbox" name="target_grades" value={g} defaultChecked={event?.target_grades.includes(g)} />
              {g}학년
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="대상 설명" name="target_note" defaultValue={event?.target_note ?? ""} placeholder="예: 27학번 신입생, 희망자" />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">설명</span>
        <textarea name="description" rows={5} defaultValue={event?.description} className="rounded-md border border-zinc-300 bg-white px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700">상태</span>
        <select name="status" defaultValue={event?.status ?? "published"} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
          <option value="draft">검수 대기 (학생에게 안 보임)</option>
          <option value="published">게시</option>
          <option value="archived">보관 (숨김)</option>
        </select>
      </label>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.message && <Alert kind="info">{state.message}</Alert>}
      <Button disabled={pending}>{pending ? "저장 중…" : "저장"}</Button>
    </form>
  );
}
