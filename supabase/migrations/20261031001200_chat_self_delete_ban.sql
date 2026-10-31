-- 소통방 보완
-- 1) 본인 메시지 삭제: 학생에게는 내용을 지우지만(body = ''), 원래 내용은 deleted_body에 남겨 관리자만 확인한다
--    (욕설을 쓰고 바로 지워 증거를 없애지 못하게). 경고받은 메시지는 본인이 지울 수 없다.
-- 2) 경고 3회: 글쓰기뿐 아니라 소통방 입장(메시지 읽기) 자체를 막는다. 관리자는 해당 없음.

alter table public.chat_messages
  add column deleted_body text,
  add column deleted_self boolean not null default false;

-- deleted_body는 학생이 읽을 수 없다 (칸 권한). 본인 삭제 여부만 공개
grant select (deleted_self) on public.chat_messages to authenticated;

-- 경고 3회로 이용이 제한된 계정인지 (관리자는 제한 없음)
create or replace function public.chat_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_admin() and exists (select 1 from public.chat_members where user_id = auth.uid() and warnings >= 3)
$$;

drop policy "chat_messages: 승인 회원 조회" on public.chat_messages;
create policy "chat_messages: 승인 회원 조회 (이용 제한 제외)" on public.chat_messages for select to authenticated
  using (public.is_approved() and not public.chat_banned());

-- 관리자 삭제: 원래 내용을 deleted_body에 남긴다
create or replace function public.chat_delete_message(p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 삭제할 수 있어요.'; end if;
  update public.chat_messages
    set deleted_body = coalesce(deleted_body, body), body = '', deleted_at = now(), deleted_by = auth.uid(), deleted_self = false
  where id = p_message and deleted_at is null;
end;
$$;

-- 본인 삭제: 내 메시지이고, 경고받지 않은 메시지만
create or replace function public.chat_delete_own(p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.chat_banned() then raise exception '소통방 이용이 제한되었어요.'; end if;
  if exists (select 1 from public.chat_warnings where message_id = p_message) then
    raise exception '경고받은 메시지는 지울 수 없어요.';
  end if;
  update public.chat_messages
    set deleted_body = body, body = '', deleted_at = now(), deleted_by = auth.uid(), deleted_self = true
  where id = p_message and deleted_at is null and member_id = public.my_chat_member_id();
  if not found then raise exception '지울 수 있는 메시지가 아니에요.'; end if;
end;
$$;

-- 관리자: 지워진 메시지의 원래 내용 (관리자가 아니면 빈 결과)
create or replace function public.chat_deleted_bodies(p_messages bigint[])
returns table (id bigint, body text)
language sql stable security definer set search_path = public as $$
  select m.id, m.deleted_body from public.chat_messages m
  where public.is_admin() and m.id = any (p_messages) and m.deleted_body is not null
$$;

revoke all on function public.chat_banned(), public.chat_delete_own(bigint), public.chat_deleted_bodies(bigint[]) from public, anon;
grant execute on function public.chat_banned(), public.chat_delete_own(bigint), public.chat_deleted_bodies(bigint[]) to authenticated, service_role;

-- 3) 관리자: 닉네임별 멤버 관리 (실명·학번·학년·메시지 수·마지막 활동·경고)
create or replace function public.chat_admin_members()
returns table (
  id uuid, nickname text, staff boolean, warnings smallint, name text, student_no text, grade smallint,
  message_count bigint, last_message_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.nickname, m.staff, m.warnings, p.name, p.student_no, p.grade::smallint,
         count(c.id), max(c.created_at), m.created_at
  from public.chat_members m
  join public.profiles p on p.id = m.user_id
  left join public.chat_messages c on c.member_id = m.id
  where public.is_admin()
  group by m.id, p.id
  order by m.warnings desc, max(c.created_at) desc nulls last
$$;

-- 관리자: 메시지 없이 멤버에게 직접 경고. p_ban이면 바로 이용 제한(경고 3회로 맞춤)
create or replace function public.chat_warn_member(p_member uuid, p_reason text, p_ban boolean default false)
returns table (user_id uuid, warnings smallint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if char_length(btrim(p_reason)) not between 1 and 200 then raise exception '사유를 1~200자로 적어 주세요.'; end if;
  insert into public.chat_warnings (member_id, reason, admin_id) values (p_member, btrim(p_reason), auth.uid());
  return query
    update public.chat_members m
      set warnings = case when p_ban then greatest(m.warnings + 1, 3) else m.warnings + 1 end, updated_at = now()
    where m.id = p_member
    returning m.user_id, m.warnings;
end;
$$;

revoke all on function public.chat_admin_members(), public.chat_warn_member(uuid, text, boolean) from public, anon;
grant execute on function public.chat_admin_members(), public.chat_warn_member(uuid, text, boolean) to authenticated, service_role;

-- 4) 닉네임 변경 기록 (관리자만 조회)
create table public.chat_nickname_history (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.chat_members (id) on delete cascade,
  old_nickname text not null,
  new_nickname text not null,
  changed_at timestamptz not null default now()
);
create index chat_nickname_history_member_idx on public.chat_nickname_history (member_id, changed_at desc);
alter table public.chat_nickname_history enable row level security;
create policy "chat_nickname_history: 관리자 조회" on public.chat_nickname_history for select to authenticated using (public.is_admin());
revoke all on public.chat_nickname_history from anon, authenticated;
grant select on public.chat_nickname_history to authenticated;
grant all on public.chat_nickname_history to service_role;

-- 닉네임 정하기·바꾸기: 바꿀 때 이전 닉네임을 기록한다
create or replace function public.set_chat_nickname(p_nickname text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_nick text := btrim(p_nickname);
  v_id uuid;
  v_old text;
begin
  if not public.is_approved() then raise exception '승인된 회원만 소통방을 쓸 수 있어요.'; end if;
  if public.chat_banned() then raise exception '소통방 이용이 제한되었어요.'; end if;
  if char_length(v_nick) not between 2 and 12 then raise exception '닉네임은 2~12자로 정해 주세요.'; end if;
  if exists (select 1 from public.chat_members where lower(nickname) = lower(v_nick) and user_id <> auth.uid()) then
    raise exception '이미 쓰는 닉네임이에요.';
  end if;
  select id, nickname into v_id, v_old from public.chat_members where user_id = auth.uid();
  if v_id is null then
    insert into public.chat_members (user_id, nickname, staff) values (auth.uid(), v_nick, public.is_admin()) returning id into v_id;
  elsif v_old is distinct from v_nick then
    update public.chat_members set nickname = v_nick, staff = public.is_admin(), updated_at = now() where id = v_id;
    insert into public.chat_nickname_history (member_id, old_nickname, new_nickname) values (v_id, v_old, v_nick);
  end if;
  return v_id;
end;
$$;
