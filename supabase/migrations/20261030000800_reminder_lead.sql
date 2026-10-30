-- 내 캘린더 일정 알림: 하루 전(1440분)에 더해 1시간 전(60분)도 따로 켤 수 있게
-- event_reminders에 '몇 분 전' 칸만 추가한다. 이미 켜 둔 알림은 하루 전(1440)으로 그대로 남는다.
alter table public.event_reminders
  add column lead_minutes smallint not null default 1440 check (lead_minutes in (60, 1440));

alter table public.event_reminders drop constraint event_reminders_pkey;
alter table public.event_reminders add primary key (user_id, target_type, target_id, lead_minutes);
