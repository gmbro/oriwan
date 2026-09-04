-- TWTT 교정운동 민감정보 만료 파기 스케줄 (명시적 opt-in)
-- 선행 조건: docs/migrations/2026-09-04-corrective-exercise.sql 적용 완료
-- Supabase SQL Editor에서 운영자가 직접 실행할 때만 pg_cron과 일정을 등록합니다.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 같은 이름의 이전 작업을 제거한 뒤 다시 만들어 재실행해도 중복 실행되지 않습니다.
DO $$
DECLARE
  existing_job RECORD;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'twtt-corrective-exercise-retention-daily'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

-- Supabase 데이터베이스 기본 UTC 기준 18:17 = 한국시간 다음 날 03:17입니다.
SELECT cron.schedule(
  'twtt-corrective-exercise-retention-daily',
  '17 18 * * *',
  $schedule$SELECT public.purge_expired_corrective_exercise_applications();$schedule$
);

COMMIT;

-- 설치 확인:
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname = 'twtt-corrective-exercise-retention-daily';
--
-- 최근 실행 확인:
-- SELECT status, start_time, end_time, return_message
-- FROM cron.job_run_details
-- WHERE jobid IN (
--   SELECT jobid FROM cron.job WHERE jobname = 'twtt-corrective-exercise-retention-daily'
-- )
-- ORDER BY start_time DESC
-- LIMIT 10;
