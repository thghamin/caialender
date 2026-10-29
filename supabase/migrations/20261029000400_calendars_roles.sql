-- 학사 캘린더 / 학과 캘린더 구분, 총관리자와 관리자 임명

-- ───────────────────────── events.calendar ─────────────────────────
-- academic: 경북대 학사일정 (학교 공식), dept: 학생회가 올리는 학과 일정
alter table public.events
  add column calendar text not null default 'dept' check (calendar in ('academic', 'dept')),
  -- 외부에서 가져온 일정의 고유 키 (예: "knu:2026-03-03:개강"). 다시 불러올 때 중복을 막는다
  add column external_key text unique;

create index events_calendar_idx on public.events (calendar, start_at);

-- ───────────────────────── 역할: super_admin ─────────────────────────
-- super_admin(총관리자)은 관리자 권한 전체 + 관리자 임명/해제
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'admin', 'super_admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

-- 총관리자만 다른 사용자를 관리자(admin) 또는 학생(student)으로 바꿀 수 있다.
-- 총관리자 지정은 서버 스크립트(service role)로만 한다.
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception '총관리자만 관리자를 임명할 수 있습니다.' using errcode = '42501';
  end if;
  if p_role not in ('student', 'admin') then
    raise exception '지정할 수 없는 역할입니다: %', p_role using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신의 역할은 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user and role <> 'super_admin';
  if not found then
    raise exception '대상 사용자를 찾을 수 없거나 총관리자입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.is_super_admin() to anon, authenticated, service_role;
