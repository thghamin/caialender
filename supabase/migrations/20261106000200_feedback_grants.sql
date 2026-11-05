-- 베타 의견 테이블 권한: 접근은 RLS 정책이 막고, 비로그인(anon)은 아예 못 쓴다
revoke all on public.feedback from anon;
grant select, insert, update, delete on public.feedback to authenticated;
grant all on public.feedback to service_role;
