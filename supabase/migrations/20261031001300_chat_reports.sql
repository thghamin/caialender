-- 소통방 신고: 학생이 다른 학생의 메시지를 신고 → 관리자에게 알림 → 관리자가 처리(경고·삭제·문제없음)
-- 신고자는 신고당한 학생에게 보이지 않는다(관리자만 확인). 같은 메시지는 한 사람이 한 번만 신고.

create table public.chat_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reporter_id uuid not null references public.chat_members (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  unique (message_id, reporter_id)
);
create index chat_reports_open_idx on public.chat_reports (status, created_at desc);

alter table public.chat_reports enable row level security;
-- 직접 읽기·쓰기는 막고, 아래 함수로만 다룬다
revoke all on public.chat_reports from anon, authenticated;
grant all on public.chat_reports to service_role;

-- 학생: 신고하기 (승인 회원, 이용 제한 아님, 내 메시지 아님, 지워지지 않은 메시지)
create or replace function public.chat_report(p_message bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_chat_member_id();
  v_author uuid;
begin
  if not public.is_approved() or public.chat_banned() then raise exception '소통방을 이용할 수 없어요.'; end if;
  if v_me is null then raise exception '먼저 닉네임을 정해 주세요.'; end if;
  if char_length(btrim(p_reason)) not between 1 and 200 then raise exception '신고 사유를 1~200자로 적어 주세요.'; end if;
  select member_id into v_author from public.chat_messages where id = p_message and deleted_at is null;
  if v_author is null then raise exception '신고할 수 없는 메시지예요.'; end if;
  if v_author = v_me then raise exception '내 메시지는 신고할 수 없어요.'; end if;
  insert into public.chat_reports (message_id, reporter_id, reason) values (p_message, v_me, btrim(p_reason));
exception when unique_violation then
  raise exception '이미 신고한 메시지예요.';
end;
$$;

-- 관리자: 신고 목록 (메시지 원래 내용·작성자·신고자 실명 포함). 관리자가 아니면 빈 결과
create or replace function public.chat_admin_reports(p_open_only boolean default true)
returns table (
  id bigint, status text, reason text, created_at timestamptz,
  message_id bigint, room smallint, body text, message_deleted boolean, message_at timestamptz,
  author_id uuid, author_nickname text, author_name text, author_warnings smallint,
  reporter_nickname text, reporter_name text, report_count bigint
)
language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.reason, r.created_at,
         m.id, m.room, coalesce(m.deleted_body, m.body), m.deleted_at is not null, m.created_at,
         a.id, a.nickname, ap.name, a.warnings,
         rep.nickname, rp.name,
         (select count(*) from public.chat_reports x where x.message_id = m.id)
  from public.chat_reports r
  join public.chat_messages m on m.id = r.message_id
  join public.chat_members a on a.id = m.member_id
  join public.profiles ap on ap.id = a.user_id
  join public.chat_members rep on rep.id = r.reporter_id
  join public.profiles rp on rp.id = rep.user_id
  where public.is_admin() and (not p_open_only or r.status = 'open')
  order by r.created_at desc
  limit 200
$$;

-- 관리자: 한 메시지에 걸린 열린 신고를 모두 처리 (resolved: 조치함, dismissed: 문제없음)
create or replace function public.chat_handle_reports(p_message bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception '잘못된 처리 상태예요.'; end if;
  update public.chat_reports set status = p_status, handled_by = auth.uid(), handled_at = now()
  where message_id = p_message and status = 'open';
end;
$$;

-- 관리자: 처리 안 한 신고 수 (메뉴 배지용)
create or replace function public.chat_open_report_count()
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select count(distinct message_id) from public.chat_reports where status = 'open') else 0 end
$$;

revoke all on function public.chat_report(bigint, text), public.chat_admin_reports(boolean),
  public.chat_handle_reports(bigint, text), public.chat_open_report_count() from public, anon;
grant execute on function public.chat_report(bigint, text), public.chat_admin_reports(boolean),
  public.chat_handle_reports(bigint, text), public.chat_open_report_count() to authenticated, service_role;

-- 답장: 같은 방의 메시지에만
alter table public.chat_messages add column reply_to bigint references public.chat_messages (id) on delete set null;
grant select (reply_to) on public.chat_messages to authenticated;
grant insert (reply_to) on public.chat_messages to authenticated;

create or replace function public.chat_reply_same_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to is not null and not exists (select 1 from public.chat_messages where id = new.reply_to and room = new.room) then
    raise exception '같은 방의 메시지에만 답장할 수 있어요.';
  end if;
  return new;
end;
$$;
create trigger chat_messages_reply_same_room before insert on public.chat_messages
  for each row execute function public.chat_reply_same_room();

-- 소통방 알림: 방마다 켜고 끈다. 기본은 꺼짐(행이 없음)
create table public.chat_room_alerts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  room smallint not null check (room between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (user_id, room)
);
alter table public.chat_room_alerts enable row level security;
create policy "chat_room_alerts: 본인 조회" on public.chat_room_alerts for select to authenticated using (user_id = auth.uid());
create policy "chat_room_alerts: 본인 켜기" on public.chat_room_alerts for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());
create policy "chat_room_alerts: 본인 끄기" on public.chat_room_alerts for delete to authenticated using (user_id = auth.uid());
revoke all on public.chat_room_alerts from anon, authenticated;
grant select, insert, delete on public.chat_room_alerts to authenticated;
grant all on public.chat_room_alerts to service_role;

-- 학생회 공식 이름: 관리자는 평소엔 자기 닉네임(학생회 표시 없음)으로 대화하고,
-- 필요할 때만 공용 '학생회' 이름으로 보낸다(공지·제재 안내). 누가 보냈는지는 posted_by에만 남긴다(학생은 못 읽음).
alter table public.chat_members alter column user_id drop not null;
insert into public.chat_members (id, user_id, nickname, staff)
values ('00000000-0000-0000-0000-00000000c0de', null, '학생회', true)
on conflict (id) do nothing;
-- 관리자가 누군지 드러나지 않도록 staff 칸은 학생이 읽을 수 없게
revoke select (staff) on public.chat_members from authenticated;

alter table public.chat_messages add column posted_by uuid references public.profiles (id) on delete set null;

create or replace function public.chat_post_as_staff(p_room smallint, p_body text, p_reply bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then raise exception '관리자만 학생회 이름으로 보낼 수 있어요.'; end if;
  if char_length(btrim(p_body)) not between 1 and 500 then raise exception '메시지는 1~500자로 써 주세요.'; end if;
  insert into public.chat_messages (room, member_id, body, reply_to, posted_by)
  values (p_room, '00000000-0000-0000-0000-00000000c0de', btrim(p_body), p_reply, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.chat_post_as_staff(smallint, text, bigint) from public, anon;
grant execute on function public.chat_post_as_staff(smallint, text, bigint) to authenticated, service_role;

-- 학생회 공식 메시지는 신고 대상이 아니다
create or replace function public.chat_report(p_message bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_chat_member_id();
  v_author uuid;
begin
  if not public.is_approved() or public.chat_banned() then raise exception '소통방을 이용할 수 없어요.'; end if;
  if v_me is null then raise exception '먼저 닉네임을 정해 주세요.'; end if;
  if char_length(btrim(p_reason)) not between 1 and 200 then raise exception '신고 사유를 1~200자로 적어 주세요.'; end if;
  select member_id into v_author from public.chat_messages where id = p_message and deleted_at is null;
  if v_author is null then raise exception '신고할 수 없는 메시지예요.'; end if;
  if v_author = '00000000-0000-0000-0000-00000000c0de' then raise exception '학생회 공지는 신고할 수 없어요.'; end if;
  if v_author = v_me then raise exception '내 메시지는 신고할 수 없어요.'; end if;
  insert into public.chat_reports (message_id, reporter_id, reason) values (p_message, v_me, btrim(p_reason));
exception when unique_violation then
  raise exception '이미 신고한 메시지예요.';
end;
$$;
