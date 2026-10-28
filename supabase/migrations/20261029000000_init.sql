-- C:AI:ender 초기 스키마
-- 사용자 프로필, 공지, 일정, 관심 일정, 개인 일정, 일정 변경 이력 + RLS

create extension if not exists pgcrypto;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  student_no text,
  grade smallint check (grade between 1 and 4),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- 관리자 여부 (RLS 정책 안에서 재귀 없이 쓰기 위해 security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- 회원가입 시 프로필 자동 생성 (메타데이터의 name/grade/student_no 사용)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, student_no, grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'student_no', ''),
    nullif(new.raw_user_meta_data ->> 'grade', '')::smallint
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: 본인 또는 관리자 조회" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- role 컬럼은 클라이언트에서 바꿀 수 없도록 컬럼 단위 권한 제한
revoke update on public.profiles from authenticated, anon;
grant update (name, student_no, grade) on public.profiles to authenticated;

-- ───────────────────────── notices ─────────────────────────
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_path text,                -- storage 'posters' 버킷 경로
  posted_at timestamptz not null default now(),  -- 공지방에 올라온 시각
  -- 비동기 AI 분석 작업 상태: queued → processing → analyzed | failed
  status text not null default 'queued' check (status in ('queued', 'processing', 'analyzed', 'failed')),
  attempts smallint not null default 0,
  last_error text,
  locked_at timestamptz,          -- processing 시작 시각 (오래되면 재시도 대상)
  ai_result jsonb,                -- 마지막 AI 분석 원본 결과
  ai_model text,
  analyzed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notices_status_idx on public.notices (status, created_at);

alter table public.notices enable row level security;

create policy "notices: 로그인 사용자 조회" on public.notices
  for select to authenticated using (true);
create policy "notices: 관리자 작성" on public.notices
  for insert to authenticated with check (public.is_admin());
create policy "notices: 관리자 수정" on public.notices
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "notices: 관리자 삭제" on public.notices
  for delete to authenticated using (public.is_admin());

-- ───────────────────────── events ─────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.notices (id) on delete set null,
  title text not null,
  description text not null default '',
  kind text not null default 'event' check (kind in ('event', 'deadline', 'other')),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  target_grades smallint[] not null default '{}',  -- 비어 있으면 전체 대상
  target_note text,                                -- 대상 설명 원문 (예: "신입생", "희망자")
  missing_fields text[] not null default '{}',     -- AI가 찾지 못한 정보
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);

create index events_start_idx on public.events (start_at);
create index events_notice_idx on public.events (notice_id);

alter table public.events enable row level security;

create policy "events: 게시된 일정은 누구나 조회" on public.events
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());
create policy "events: 관리자 작성" on public.events
  for insert to authenticated with check (public.is_admin());
create policy "events: 관리자 수정" on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "events: 관리자 삭제" on public.events
  for delete to authenticated using (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- ───────────────────────── event_changes (변경 탐지 이력) ─────────────────────────
create table public.event_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  notice_id uuid references public.notices (id) on delete set null,
  changes jsonb not null,         -- [{field, before, after}]
  summary text not null default '',
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.event_changes enable row level security;

create policy "event_changes: 관리자 전체" on public.event_changes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "event_changes: 반영된 변경은 로그인 사용자 조회" on public.event_changes
  for select to authenticated using (status = 'applied');

-- ───────────────────────── user_events (내 캘린더 관심 일정) ─────────────────────────
create table public.user_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.user_events enable row level security;

create policy "user_events: 본인 것만" on public.user_events
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── personal_events (개인 일정) ─────────────────────────
create table public.personal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create index personal_events_user_idx on public.personal_events (user_id, start_at);

alter table public.personal_events enable row level security;

create policy "personal_events: 본인 것만" on public.personal_events
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── storage: 포스터 이미지 ─────────────────────────
insert into storage.buckets (id, name, public)
values ('posters', 'posters', false)
on conflict (id) do nothing;

create policy "posters: 로그인 사용자 조회" on storage.objects
  for select to authenticated using (bucket_id = 'posters');
create policy "posters: 관리자 업로드" on storage.objects
  for insert to authenticated with check (bucket_id = 'posters' and public.is_admin());
create policy "posters: 관리자 삭제" on storage.objects
  for delete to authenticated using (bucket_id = 'posters' and public.is_admin());

-- ───────────────────────── 공지 분석 작업 큐 ─────────────────────────
-- 분석할 공지 하나를 원자적으로 가져와 processing 상태로 바꾼다.
-- p_id가 주어지면 그 공지만, 없으면 가장 오래 기다린 공지를 가져온다.
-- 대상: queued / 재시도 가능한 failed(3회 미만) / 5분 넘게 멈춘 processing
create or replace function public.claim_notice_job(p_id uuid default null)
returns setof public.notices
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notices n
  set status = 'processing', locked_at = now(), attempts = n.attempts + 1
  where n.id = (
    select c.id from public.notices c
    where (p_id is null or c.id = p_id)
      and (
        c.status = 'queued'
        or (c.status = 'processing' and c.locked_at < now() - interval '5 minutes')
      )
      and c.attempts < 3
    order by c.created_at
    limit 1
    for update skip locked
  )
  returning n.*;
end;
$$;

revoke execute on function public.claim_notice_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_notice_job(uuid) to service_role;
