-- 테이블 권한 명시 부여
-- 이 Supabase 프로젝트는 public 스키마의 새 테이블에 anon/authenticated 권한을 자동으로 주지 않는다.
-- 실제 접근 제어는 RLS 정책이 담당하고, 여기서는 각 역할이 시도할 수 있는 작업만 연다.

grant usage on schema public to anon, authenticated, service_role;

-- 서버(service role): 전체
grant select, insert, update, delete on all tables in schema public to service_role;

-- profiles: 조회, 일부 컬럼 수정(role 제외, init에서 컬럼 단위로 부여)
grant select on public.profiles to authenticated;

-- notices: 로그인 사용자 조회, 쓰기는 RLS로 관리자만
grant select, insert, update, delete on public.notices to authenticated;

-- events: 게시된 일정은 비로그인도 조회
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;

grant select, insert, update, delete on public.event_changes to authenticated;
grant select, insert, update, delete on public.user_events to authenticated;
grant select, insert, update, delete on public.personal_events to authenticated;

-- briefings: 조회만 (쓰기는 서버 전용)
grant select on public.briefings to anon, authenticated;

-- RLS 정책 안에서 호출되는 함수
grant execute on function public.is_admin() to anon, authenticated, service_role;
