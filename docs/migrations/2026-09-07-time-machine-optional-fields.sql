-- TWTT 4기 목표 타임머신의 세부 목표를 제거하고 다짐을 선택 입력으로 전환합니다.
-- 기존 목표의 내용은 수정하지 않고, 새 목표가 빈 문자열을 안전하게 저장하도록 제약만 완화합니다.
BEGIN;

ALTER TABLE public.time_machine_goals
  ALTER COLUMN goal_detail SET DEFAULT '',
  ALTER COLUMN commitment SET DEFAULT '',
  DROP CONSTRAINT IF EXISTS time_machine_goals_goal_detail_check,
  DROP CONSTRAINT IF EXISTS time_machine_goals_commitment_check;

ALTER TABLE public.time_machine_goals
  ADD CONSTRAINT time_machine_goals_goal_detail_check
    CHECK (char_length(goal_detail) BETWEEN 0 AND 500),
  ADD CONSTRAINT time_machine_goals_commitment_check
    CHECK (char_length(commitment) BETWEEN 0 AND 300);

COMMIT;
NOTIFY pgrst, 'reload schema';
