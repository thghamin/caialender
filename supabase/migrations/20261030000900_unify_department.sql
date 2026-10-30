-- 이 서비스는 경북대 전자공학부 인공지능전공 전용이므로 회원의 학과를 하나로 통일한다 (2026-10-30 사용자 요청)
-- 학과(department) 칸만 바꾸고, 이름·학번·학년·권한·승인 상태 등 다른 회원 정보는 그대로 둔다.
update public.profiles set department = '전자공학부 인공지능전공'
where department is distinct from '전자공학부 인공지능전공';
