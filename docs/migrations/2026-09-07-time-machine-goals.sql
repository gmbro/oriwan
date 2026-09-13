-- TWTT 4기 목표 타임머신: 개인 API는 2027-01-01 00:00 KST 전까지 목표 본문을 봉인합니다.
-- OTP 인증 관리자 API는 운영을 위해 목표 확인·재설정을 지원합니다.
-- 이 파일은 Supabase SQL Editor에서 한 번 실행합니다. service_role을 사용하는 서버 경로만 접근합니다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.time_machine_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key = '4th'),
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_title TEXT NOT NULL CHECK (char_length(goal_title) BETWEEN 2 AND 80),
  goal_detail TEXT DEFAULT '' NOT NULL CHECK (char_length(goal_detail) BETWEEN 0 AND 500),
  commitment TEXT DEFAULT '' NOT NULL CHECK (char_length(commitment) BETWEEN 0 AND 300),
  unlock_at TIMESTAMPTZ DEFAULT '2026-12-31 15:00:00+00'::timestamptz NOT NULL
    CHECK (unlock_at = '2026-12-31 15:00:00+00'::timestamptz),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(season_key, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_time_machine_goals_member
  ON public.time_machine_goals(auth_user_id, season_key);

ALTER TABLE public.time_machine_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.time_machine_goals FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.time_machine_goals TO service_role;

COMMENT ON TABLE public.time_machine_goals IS
  'TWTT 4기 목표 캡슐. 개인 API의 목표 본문 공개는 고정 KST 개봉 시각으로 강제하고, OTP 인증 관리자는 운영 목적으로 확인·재설정한다.';

COMMIT;
NOTIFY pgrst, 'reload schema';
