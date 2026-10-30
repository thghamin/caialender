-- 내 시간표, 휴대폰 알림(웹 푸시), AI 근거 표시·학생회 성과 지표
-- 새 테이블과 events의 새 컬럼만 추가한다. 기존 회원(profiles)·데이터는 바꾸지 않는다.

-- ───────────────────────── AI 근거, 검수 수정 여부 ─────────────────────────
alter table public.events
  add column evidence text,                                   -- AI가 일정을 뽑은 공지 원문 문장
  add column ai_edited boolean not null default false;        -- 기획부가 AI 초안을 고쳤는지 (성과 지표용)

-- ───────────────────────── 내 시간표 ─────────────────────────
create table public.timetable_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  professor text check (professor is null or char_length(professor) <= 40),
  color smallint not null default 0,            -- 시간표 칸 색 번호
  reminder boolean not null default false,      -- 수업 10분 전 알림
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now()
);

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.timetable_courses (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day smallint not null check (day between 0 and 6),          -- 0=월 … 6=일
  start_min smallint not null check (start_min between 0 and 1435),  -- 0시부터 분, 5분 단위
  end_min smallint not null check (end_min between 5 and 1440),
  location text check (location is null or char_length(location) <= 80),
  check (end_min > start_min)
);

create index timetable_courses_user_idx on public.timetable_courses (user_id);
create index timetable_slots_course_idx on public.timetable_slots (course_id);
create index timetable_slots_day_idx on public.timetable_slots (day, start_min);

alter table public.timetable_courses enable row level security;
alter table public.timetable_slots enable row level security;

create policy "timetable_courses: 승인 회원 본인 것만" on public.timetable_courses
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

create policy "timetable_slots: 승인 회원 본인 것만" on public.timetable_slots
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.timetable_courses c where c.id = course_id and c.user_id = auth.uid())
  );

-- ───────────────────────── 일정 알림 (내 캘린더) ─────────────────────────
-- 켜 둔 일정만 행이 있다. event: 학과·학사 일정, personal: 개인 일정
create table public.event_reminders (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('event', 'personal')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table public.event_reminders enable row level security;
create policy "event_reminders: 승인 회원 본인 것만" on public.event_reminders
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

-- ───────────────────────── 휴대폰(브라우저) 푸시 구독 ─────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: 승인 회원 본인 것만" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

-- 보낸 알림 기록 (같은 알림을 두 번 보내지 않도록). 서버 전용
create table public.notification_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notification_log enable row level security;

-- ───────────────────────── 권한 ─────────────────────────
grant select, insert, update, delete on public.timetable_courses, public.timetable_slots,
  public.event_reminders, public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.timetable_courses, public.timetable_slots,
  public.event_reminders, public.push_subscriptions, public.notification_log to service_role;
