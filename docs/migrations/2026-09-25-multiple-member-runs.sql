BEGIN;
ALTER TABLE public.daily_run_records ADD COLUMN IF NOT EXISTS submission_key text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_run_records_date_submission ON public.daily_run_records(season_key,user_id,participant_id,record_date,submission_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_run_records_image_submission ON public.daily_run_records(season_key,user_id,participant_id,submission_key) WHERE submission_key <> '';
DROP INDEX IF EXISTS public.idx_daily_run_records_season_participant_date;
COMMIT;
