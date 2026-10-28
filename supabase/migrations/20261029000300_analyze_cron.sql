-- 실패·대기 중인 공지 AI 분석을 1분마다 재시도하는 예약 작업
-- 배포 주소와 비밀값은 git에 남기지 않도록 scripts/setup-cron.mjs가 아래 함수를 호출해 설정한다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.setup_analyze_cron(p_url text, p_secret text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_command text;
begin
  if exists (select 1 from cron.job where jobname = 'caialender-analyze-retry') then
    perform cron.unschedule('caialender-analyze-retry');
  end if;

  job_command := format(
    $cmd$select net.http_post(
      url := %L,
      headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    )$cmd$,
    p_url,
    'Bearer ' || p_secret
  );

  perform cron.schedule('caialender-analyze-retry', '* * * * *', job_command);
  return 'scheduled: ' || p_url;
end;
$$;

revoke execute on function public.setup_analyze_cron(text, text) from public, anon, authenticated;
grant execute on function public.setup_analyze_cron(text, text) to service_role;

-- 작업 상태 확인용 (서버 전용)
create or replace function public.analyze_cron_status()
returns table (jobname text, schedule text, active boolean, last_status text, last_run timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select j.jobname::text, j.schedule::text, j.active,
         (select d.status::text from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
         (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1)
  from cron.job j where j.jobname = 'caialender-analyze-retry';
$$;

revoke execute on function public.analyze_cron_status() from public, anon, authenticated;
grant execute on function public.analyze_cron_status() to service_role;
