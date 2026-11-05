-- 개인 일정: 종일 일정과 여러 날(기간) 일정
-- 종일이면 start_at = 첫날 0시(KST), end_at = 마지막 날 0시(KST) (학과 일정과 같은 규칙). 기존 일정은 모두 시간 지정(false)
alter table public.personal_events add column all_day boolean not null default false;
