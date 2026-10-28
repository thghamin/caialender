-- AI 부가 기능: 주간 브리핑 캐시, 공지 챗봇 기록

-- 주간 브리핑. user_id가 null이면 전체 캘린더 브리핑
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  week_start date not null,           -- 해당 주 월요일 (KST)
  content text not null,
  source_hash text not null,          -- 브리핑에 사용한 일정 목록의 해시 (바뀌면 다시 생성)
  model text,
  created_at timestamptz not null default now()
);

create unique index briefings_scope_idx
  on public.briefings (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), week_start);

alter table public.briefings enable row level security;

create policy "briefings: 전체 브리핑은 누구나, 개인 브리핑은 본인만 조회" on public.briefings
  for select to anon, authenticated
  using (user_id is null or user_id = auth.uid());
-- 쓰기는 서버(service role)에서만

-- 공지 챗봇 질의응답 기록 (사용량 제한, 품질 점검용)
create table public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notice_id uuid references public.notices (id) on delete set null,
  question text not null,
  answer text not null default '',
  model text,
  error text,
  created_at timestamptz not null default now()
);

create index chat_logs_user_idx on public.chat_logs (user_id, created_at desc);

alter table public.chat_logs enable row level security;

create policy "chat_logs: 본인 조회" on public.chat_logs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "chat_logs: 본인 기록" on public.chat_logs
  for insert to authenticated with check (user_id = auth.uid());
create policy "chat_logs: 본인 수정" on public.chat_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
