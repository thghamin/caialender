-- 질문 게시판: 학생이 질문을 남기면 관리자(학생회)가 직접 답한다. AI는 쓰지 않는다.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,  -- 특정 일정에 대한 질문이면
  body text not null check (char_length(body) between 1 and 1000),
  answer text check (answer is null or char_length(answer) between 1 and 2000),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index questions_created_idx on public.questions (created_at desc);
create index questions_event_idx on public.questions (event_id);

alter table public.questions enable row level security;

-- 로그인한 학생은 모든 질문과 답변을 볼 수 있다 (다른 학생 이름은 profiles RLS로 가려진다)
create policy "questions: 로그인 사용자 조회" on public.questions
  for select to authenticated using (true);

-- 본인 이름으로만, 답변 없이 작성
create policy "questions: 본인 작성" on public.questions
  for insert to authenticated
  with check (user_id = auth.uid() and answer is null and answered_by is null and answered_at is null);

-- 답변 전까지 본인이 수정 (답변 칸은 건드릴 수 없음)
create policy "questions: 답변 전 본인 수정" on public.questions
  for update to authenticated
  using (user_id = auth.uid() and answered_at is null)
  with check (user_id = auth.uid() and answer is null and answered_by is null and answered_at is null);

-- 관리자는 답변 작성·수정
create policy "questions: 관리자 답변" on public.questions
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "questions: 답변 전 본인 삭제" on public.questions
  for delete to authenticated using (user_id = auth.uid() and answered_at is null);
create policy "questions: 관리자 삭제" on public.questions
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.questions to service_role;
