-- TWTT 4기 교정운동 폼을 일정·문진형 신청에서 간단 문의로 전환합니다.
-- 기존 신청과 관리자 이력은 보존하며 새 문의는 inquiry_message만 저장합니다.
BEGIN;

ALTER TABLE public.corrective_exercise_applications
  ADD COLUMN IF NOT EXISTS inquiry_message TEXT;

UPDATE public.corrective_exercise_applications
SET inquiry_message = COALESCE(
  NULLIF(btrim(pain_context), ''),
  NULLIF(btrim(additional_note), '')
)
WHERE inquiry_message IS NULL;

ALTER TABLE public.corrective_exercise_applications
  ALTER COLUMN requested_date DROP NOT NULL,
  ALTER COLUMN requested_start_time DROP NOT NULL,
  ALTER COLUMN pain_areas DROP NOT NULL,
  ALTER COLUMN pain_context DROP NOT NULL,
  ALTER COLUMN hospital_status DROP NOT NULL,
  ALTER COLUMN consent_version DROP NOT NULL,
  ALTER COLUMN consented_at DROP DEFAULT,
  ALTER COLUMN consented_at DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.corrective_exercise_applications'::regclass
      AND conname = 'corrective_exercise_inquiry_message_length'
  ) THEN
    ALTER TABLE public.corrective_exercise_applications
      ADD CONSTRAINT corrective_exercise_inquiry_message_length
      CHECK (
        inquiry_message IS NULL
        OR char_length(inquiry_message) BETWEEN 5 AND 500
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.corrective_exercise_applications.inquiry_message IS
  '회원이 남긴 교정운동 간단 문의 본문. 새 문의에서는 이 필드만 사용한다.';

COMMIT;

NOTIFY pgrst, 'reload schema';
