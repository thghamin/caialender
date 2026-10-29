-- 회원가입 승인 시스템: 학과·승인 상태 추가, 학번 중복 방지, 승인된 회원만 서비스 데이터 접근
-- 기존 회원과 데이터는 그대로 두고, 기존 회원은 모두 '승인됨'으로 옮긴다.

-- ───────────────────────── profiles: 학과, 승인 상태 ─────────────────────────
alter table public.profiles
  add column department text,
  add column approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column approved_by uuid references public.profiles (id) on delete set null,
  add column approved_at timestamptz;

-- 이 마이그레이션 이전에 가입한 회원은 이미 서비스를 쓰던 회원이므로 승인 상태로 보존
update public.profiles set approval_status = 'approved', approved_at = now();

-- 학번 중복 가입 방지 (이메일 중복은 Supabase Auth가 막는다)
create unique index profiles_student_no_key on public.profiles (student_no) where student_no is not null;

-- ───────────────────────── 총관리자 지정 ─────────────────────────
-- 기존 계정 thghamin12@naver.com 을 유일한 총관리자로 지정한다. 새 계정은 만들지 않는다.
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'thghamin12@naver.com';
  if v_id is null then
    raise exception '총관리자로 지정할 계정 thghamin12@naver.com 을 찾을 수 없습니다.';
  end if;
  update public.profiles set role = 'admin' where role = 'super_admin' and id <> v_id;
  update public.profiles set role = 'super_admin', approval_status = 'approved', approved_at = coalesce(approved_at, now())
  where id = v_id;
  if not found then
    raise exception 'thghamin12@naver.com 계정의 프로필이 없습니다.';
  end if;
end;
$$;

-- ───────────────────────── 가입 시 프로필 생성 ─────────────────────────
-- 메타데이터에서 이름·학번·학년·학과만 읽는다. role/approval_status는 기본값(student, pending)으로 고정되어
-- 가입 과정에서 관리자 권한이나 승인 상태를 얻을 수 없다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, student_no, grade, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(trim(new.raw_user_meta_data ->> 'student_no'), ''),
    nullif(new.raw_user_meta_data ->> 'grade', '')::smallint,
    nullif(trim(new.raw_user_meta_data ->> 'department'), '')
  );
  return new;
end;
$$;

-- profiles의 role, approval_status, approved_* 컬럼은 계속 클라이언트에서 수정할 수 없다
-- (init에서 update 권한을 name, student_no, grade 컬럼에만 부여함)

-- ───────────────────────── 승인 여부 ─────────────────────────
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and approval_status = 'approved'
  );
$$;

grant execute on function public.is_approved() to anon, authenticated, service_role;

-- 관리자(일반·총관리자)가 가입을 승인·거절한다.
-- 총관리자의 상태는 누구도 바꿀 수 없고, 관리자의 상태는 총관리자만 바꿀 수 있다.
create or replace function public.set_approval(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_admin() then
    raise exception '관리자만 가입을 승인할 수 있습니다.' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception '지정할 수 없는 상태입니다: %', p_status using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신의 승인 상태는 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_user;
  if not found then
    raise exception '대상 회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_role = 'super_admin' then
    raise exception '총관리자의 상태는 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  if v_role = 'admin' and not public.is_super_admin() then
    raise exception '관리자의 상태는 총관리자만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  update public.profiles
  set approval_status = p_status,
      approved_by = auth.uid(),
      approved_at = now(),
      -- 거절하면 관리자 권한도 함께 회수
      role = case when p_status = 'rejected' then 'student' else role end
  where id = p_user;
end;
$$;

revoke execute on function public.set_approval(uuid, text) from public, anon;
grant execute on function public.set_approval(uuid, text) to authenticated;

-- 관리자 임명은 승인된 회원에게만
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
  update public.profiles set role = p_role
  where id = p_user and role <> 'super_admin' and (p_role = 'student' or approval_status = 'approved');
  if not found then
    raise exception '대상이 없거나, 총관리자이거나, 아직 승인되지 않은 회원입니다.' using errcode = 'P0002';
  end if;
end;
$$;

-- ───────────────────────── 승인된 회원만 서비스 데이터 접근 ─────────────────────────
-- 서비스 전체가 로그인 필수가 되었으므로 비로그인(anon) 조회도 닫는다.
-- 관리자 정책(is_admin)은 그대로 둔다. 관리자는 승인된 회원 중에서만 임명된다.

drop policy "events: 게시된 일정은 누구나 조회" on public.events;
create policy "events: 승인 회원은 게시된 일정 조회" on public.events
  for select to authenticated
  using ((status = 'published' and public.is_approved()) or public.is_admin());
revoke select on public.events from anon;

drop policy "notices: 로그인 사용자 조회" on public.notices;
create policy "notices: 승인 회원 조회" on public.notices
  for select to authenticated using (public.is_approved());

drop policy "event_changes: 반영된 변경은 로그인 사용자 조회" on public.event_changes;
create policy "event_changes: 반영된 변경은 승인 회원 조회" on public.event_changes
  for select to authenticated using (status = 'applied' and public.is_approved());

drop policy "user_events: 본인 것만" on public.user_events;
create policy "user_events: 승인 회원 본인 것만" on public.user_events
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

drop policy "personal_events: 본인 것만" on public.personal_events;
create policy "personal_events: 승인 회원 본인 것만" on public.personal_events
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

drop policy "briefings: 전체 브리핑은 누구나, 개인 브리핑은 본인만 조회" on public.briefings;
create policy "briefings: 승인 회원은 전체 브리핑과 본인 브리핑 조회" on public.briefings
  for select to authenticated
  using (public.is_approved() and (user_id is null or user_id = auth.uid()));
revoke select on public.briefings from anon;

drop policy "questions: 로그인 사용자 조회" on public.questions;
create policy "questions: 승인 회원 조회" on public.questions
  for select to authenticated using (public.is_approved());

drop policy "questions: 본인 작성" on public.questions;
create policy "questions: 승인 회원 본인 작성" on public.questions
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_approved()
    and answer is null and answered_by is null and answered_at is null
  );

drop policy "posters: 로그인 사용자 조회" on storage.objects;
create policy "posters: 승인 회원 조회" on storage.objects
  for select to authenticated using (bucket_id = 'posters' and public.is_approved());
