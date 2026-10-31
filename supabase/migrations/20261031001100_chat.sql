-- 학년별 소통방 (1~4학년 방, 누구나 골라서 입장)
-- 익명: 학생끼리는 닉네임만 보인다. 메시지는 계정 id가 아니라 소통방 전용 무작위 id(chat_members.id)로 남기고,
--       chat_members.user_id 칸은 학생이 읽을 수 없다(칸 권한). 실명은 관리자 전용 함수로만 조회한다.
-- 관리: 관리자는 메시지 삭제(내용까지 지움)·경고. 경고 3회면 글을 쓸 수 없다(RLS).

create table public.chat_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  staff boolean not null default false,
  warnings smallint not null default 0 check (warnings >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index chat_members_nickname_key on public.chat_members (lower(nickname));

create table public.chat_messages (
  id bigint generated always as identity primary key,
  room smallint not null check (room between 1 and 4),
  member_id uuid not null references public.chat_members (id) on delete cascade,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  -- 삭제되지 않은 메시지는 내용이 있어야 한다 (삭제하면 내용을 지운다)
  check (deleted_at is not null or char_length(body) >= 1)
);
create index chat_messages_room_idx on public.chat_messages (room, id desc);

create table public.chat_warnings (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.chat_members (id) on delete cascade,
  message_id bigint references public.chat_messages (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 200),
  admin_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index chat_warnings_member_idx on public.chat_warnings (member_id, created_at desc);

alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_warnings enable row level security;

-- 내 소통방 id (없으면 null)
create or replace function public.my_chat_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.chat_members where user_id = auth.uid()
$$;

-- 글을 쓸 수 있는지: 승인된 회원 + 본인 소통방 id + 경고 3회 미만
create or replace function public.chat_can_post(p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved() and exists (
    select 1 from public.chat_members where id = p_member and user_id = auth.uid() and warnings < 3
  )
$$;

-- chat_members: 승인 회원은 닉네임·관리자 표시만 읽을 수 있다 (user_id·경고 수는 칸 권한으로 막음)
create policy "chat_members: 승인 회원 조회" on public.chat_members for select to authenticated using (public.is_approved());
revoke all on public.chat_members from anon, authenticated;
grant select (id, nickname, staff) on public.chat_members to authenticated;
grant all on public.chat_members to service_role;

-- chat_messages: 승인 회원 조회, 본인 소통방 id로만 쓰기, 수정·삭제는 관리자 함수로만
create policy "chat_messages: 승인 회원 조회" on public.chat_messages for select to authenticated using (public.is_approved());
create policy "chat_messages: 본인 작성 (경고 3회 미만)" on public.chat_messages for insert to authenticated
  with check (public.chat_can_post(member_id) and deleted_at is null);
revoke all on public.chat_messages from anon, authenticated;
grant select (id, room, member_id, body, created_at, deleted_at) on public.chat_messages to authenticated;
grant insert (room, member_id, body) on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;

-- chat_warnings: 본인 경고와 관리자만 조회 (쓰기는 관리자 함수로만)
create policy "chat_warnings: 본인·관리자 조회" on public.chat_warnings for select to authenticated
  using (member_id = public.my_chat_member_id() or public.is_admin());
revoke all on public.chat_warnings from anon, authenticated;
grant select (id, member_id, message_id, reason, created_at) on public.chat_warnings to authenticated;
grant all on public.chat_warnings to service_role;

-- 내 소통방 정보 (닉네임·경고 수)
create or replace function public.my_chat_member()
returns table (id uuid, nickname text, staff boolean, warnings smallint)
language sql stable security definer set search_path = public as $$
  select id, nickname, staff, warnings from public.chat_members where user_id = auth.uid()
$$;

-- 닉네임 정하기·바꾸기 (승인 회원만, 겹치면 오류)
create or replace function public.set_chat_nickname(p_nickname text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_nick text := btrim(p_nickname);
  v_id uuid;
begin
  if not public.is_approved() then raise exception '승인된 회원만 소통방을 쓸 수 있어요.'; end if;
  if char_length(v_nick) not between 2 and 12 then raise exception '닉네임은 2~12자로 정해 주세요.'; end if;
  if exists (select 1 from public.chat_members where lower(nickname) = lower(v_nick) and user_id <> auth.uid()) then
    raise exception '이미 쓰는 닉네임이에요.';
  end if;
  insert into public.chat_members (user_id, nickname, staff)
  values (auth.uid(), v_nick, public.is_admin())
  on conflict (user_id) do update set nickname = excluded.nickname, staff = excluded.staff, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- 관리자: 메시지 삭제 (내용까지 지운다)
create or replace function public.chat_delete_message(p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 삭제할 수 있어요.'; end if;
  update public.chat_messages set body = '', deleted_at = now(), deleted_by = auth.uid()
  where id = p_message and deleted_at is null;
end;
$$;

-- 관리자: 메시지 작성자에게 경고 (원하면 메시지도 삭제). 경고받은 계정과 누적 횟수를 돌려준다(알림용)
create or replace function public.chat_warn(p_message bigint, p_reason text, p_delete boolean default true)
returns table (user_id uuid, warnings smallint)
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
begin
  if not public.is_admin() then raise exception '관리자만 경고할 수 있어요.'; end if;
  select member_id into v_member from public.chat_messages where id = p_message;
  if v_member is null then raise exception '메시지를 찾을 수 없어요.'; end if;
  insert into public.chat_warnings (member_id, message_id, reason, admin_id) values (v_member, p_message, btrim(p_reason), auth.uid());
  if p_delete then perform public.chat_delete_message(p_message); end if;
  return query
    update public.chat_members m set warnings = m.warnings + 1, updated_at = now()
    where m.id = v_member
    returning m.user_id, m.warnings;
end;
$$;

-- 관리자: 경고 초기화 (이용 제한 풀기)
create or replace function public.chat_reset_warnings(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  update public.chat_members set warnings = 0, updated_at = now() where id = p_member;
end;
$$;

-- 관리자: 닉네임의 실제 회원 (관리자가 아니면 빈 결과)
create or replace function public.chat_member_identities(p_members uuid[])
returns table (id uuid, name text, student_no text, grade smallint, warnings smallint)
language sql stable security definer set search_path = public as $$
  select m.id, p.name, p.student_no, p.grade::smallint, m.warnings
  from public.chat_members m join public.profiles p on p.id = m.user_id
  where public.is_admin() and m.id = any (p_members)
$$;

revoke all on function public.my_chat_member_id(), public.chat_can_post(uuid), public.my_chat_member(),
  public.set_chat_nickname(text), public.chat_delete_message(bigint), public.chat_warn(bigint, text, boolean),
  public.chat_reset_warnings(uuid), public.chat_member_identities(uuid[]) from public, anon;
grant execute on function public.my_chat_member_id(), public.chat_can_post(uuid), public.my_chat_member(),
  public.set_chat_nickname(text), public.chat_delete_message(bigint), public.chat_warn(bigint, text, boolean),
  public.chat_reset_warnings(uuid), public.chat_member_identities(uuid[]) to authenticated, service_role;
