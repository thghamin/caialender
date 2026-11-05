-- 베타 의견: 화면 맨 아래 '의견 남기기'로 보낸 의견. 학생회(관리자)만 모두 볼 수 있고, 보낸 사람은 자기 의견만 본다.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000),
  page text check (page is null or char_length(page) <= 200),  -- 어느 화면에서 보냈는지 (예: /my)
  handled boolean not null default false,                       -- 관리자가 확인했는지
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- 승인된 회원이 본인 이름으로만, 확인 전 상태로 보낸다
create policy "feedback: 본인 작성" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and handled = false and public.is_approved());

-- 보낸 사람은 자기 의견만, 관리자는 전부 본다
create policy "feedback: 본인·관리자 조회" on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 관리자만 '확인함' 표시
create policy "feedback: 관리자 확인" on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "feedback: 관리자 삭제" on public.feedback
  for delete to authenticated using (public.is_admin());
