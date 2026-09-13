-- TWTT 4기 교정운동 간단 문의를 반복 접수할 수 있도록 전환합니다.
-- 기존 문의를 삭제하거나 덮어쓰지 않으며, 운영자 화면에서 모든 이력을 유지합니다.
-- `2026-09-06-corrective-exercise-simple-inquiry.sql` 다음에 Supabase SQL Editor에서 실행하세요.
BEGIN;

-- 일정 예약용 옛 제약은 간단 문의를 한 번만 남길 수 있게 막으므로 제거합니다.
-- 과거 일정 RPC는 자체 검증을 유지하므로 중복 예약 방지는 계속 적용됩니다.
DROP INDEX IF EXISTS public.idx_corrective_exercise_one_active_per_member;

CREATE INDEX IF NOT EXISTS idx_corrective_exercise_repeat_inquiries_member
  ON public.corrective_exercise_applications(
    user_id,
    season_key,
    auth_user_id,
    participant_id,
    created_at DESC
  );

COMMENT ON INDEX public.idx_corrective_exercise_repeat_inquiries_member IS
  '반복 교정운동 문의의 회원별 최신 조회와 운영 이력 조회를 위한 인덱스';

COMMIT;

NOTIFY pgrst, 'reload schema';
