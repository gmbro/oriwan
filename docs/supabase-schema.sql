-- =============================================
-- TWTT 시즌 이미지 인증·4기 콘텐츠 운영 스키마
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 스키마와 권한을 한 번에 적용해 중간 실패 시 공개 쓰기 권한이 남지 않게 합니다.
BEGIN;

-- 1. 참가자
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  name TEXT NOT NULL,
  nickname TEXT,
  active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 이 마이그레이션을 처음 적용하는 시점의 기존 운영행은 3기 기록입니다.
-- 컬럼을 nullable로 추가한 뒤에만 백필하고, 신규행 기본값은 4기로 잠급니다.
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS season_key TEXT;
UPDATE participants
SET season_key = '3th'
WHERE season_key IS NULL;
ALTER TABLE participants
  ALTER COLUMN season_key SET DEFAULT '4th',
  ALTER COLUMN season_key SET NOT NULL;
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_season_key_check;
ALTER TABLE participants
  ADD CONSTRAINT participants_season_key_check
  CHECK (season_key ~ '^[0-9]+th$') NOT VALID;

-- 기존 운영 행은 즉시 전체 검증하지 않아 배포를 막지 않고, 신규/수정 행부터 길이를 강제합니다.
-- 정리 후 `ALTER TABLE participants VALIDATE CONSTRAINT ...`로 검증 상태를 올릴 수 있습니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'participants_name_length_check'
      AND conrelid = 'participants'::regclass
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_name_length_check
      CHECK (char_length(name) BETWEEN 1 AND 40) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'participants_nickname_length_check'
      AND conrelid = 'participants'::regclass
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_nickname_length_check
      CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 320) NOT VALID;
  END IF;
END $$;

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own participants" ON participants;
DROP POLICY IF EXISTS "Users can insert own participants" ON participants;
DROP POLICY IF EXISTS "Users can update own participants" ON participants;
DROP POLICY IF EXISTS "Users can delete own participants" ON participants;

-- 공개 Kakao 세션은 운영 테이블을 Data API로 직접 수정하지 않습니다.
-- 모든 읽기·쓰기는 권한을 재검증하는 Next.js 서버 API의 service role만 사용합니다.
REVOKE ALL ON TABLE participants FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE participants TO service_role;

CREATE INDEX IF NOT EXISTS idx_participants_user_season_order
  ON participants(user_id, season_key, active, display_order, created_at);

-- 1-1. 참가자 로그인 계정 승인 연결
-- runner_name 같은 사용자 수정 가능 metadata는 권한 판정에 사용하지 않습니다.
-- 운영자가 실제 참가자를 확인한 뒤 service role 또는 SQL Editor에서 approved로 연결합니다.
CREATE TABLE IF NOT EXISTS participant_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name_override TEXT CHECK (display_name_override IS NULL OR char_length(display_name_override) BETWEEN 2 AND 40),
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'revoked')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE participant_accounts
  ADD COLUMN IF NOT EXISTS display_name_override TEXT;
-- 기존 승인 연결도 3기로 분류하고, 이후 API가 만드는 행만 기본값 4기를 사용합니다.
ALTER TABLE participant_accounts
  ADD COLUMN IF NOT EXISTS season_key TEXT;
UPDATE participant_accounts
SET season_key = '3th'
WHERE season_key IS NULL;
ALTER TABLE participant_accounts
  ALTER COLUMN season_key SET DEFAULT '4th',
  ALTER COLUMN season_key SET NOT NULL;
ALTER TABLE participant_accounts
  DROP CONSTRAINT IF EXISTS participant_accounts_season_key_check;
ALTER TABLE participant_accounts
  ADD CONSTRAINT participant_accounts_season_key_check
  CHECK (season_key ~ '^[0-9]+th$') NOT VALID;

-- 기수별 연결을 함께 보존합니다. 4기 승인이 기존 3기 연결을 덮어쓰면 안 됩니다.
DROP INDEX IF EXISTS idx_participant_accounts_auth_user;
DROP INDEX IF EXISTS idx_participant_accounts_participant;
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_accounts_season_auth_user
  ON participant_accounts(season_key, auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_accounts_season_participant
  ON participant_accounts(season_key, participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_accounts_status
  ON participant_accounts(status);
CREATE INDEX IF NOT EXISTS idx_participant_accounts_season_status
  ON participant_accounts(season_key, status);

ALTER TABLE participant_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own participant account" ON participant_accounts;

REVOKE ALL ON TABLE participant_accounts FROM anon;
REVOKE ALL ON TABLE participant_accounts FROM authenticated;
REVOKE ALL ON TABLE participant_accounts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE participant_accounts TO service_role;

-- 승인 전 확인:
-- SELECT id, email, raw_user_meta_data->>'runner_name' AS requested_name FROM auth.users ORDER BY created_at DESC;
-- SELECT id, name FROM participants WHERE active = TRUE ORDER BY display_order, created_at;
-- 승인 예시(세 UUID는 운영자가 직접 확인한 값으로 교체):
-- INSERT INTO participant_accounts (season_key, participant_id, auth_user_id, status, approved_at, approved_by)
-- VALUES ('4th', 'participant-uuid', 'kakao-auth-user-uuid', 'approved', NOW(), 'admin-auth-user-uuid')
-- ON CONFLICT (season_key, auth_user_id) DO UPDATE
-- SET participant_id = EXCLUDED.participant_id,
--     season_key = EXCLUDED.season_key,
--     status = 'approved',
--     approved_at = NOW(),
--     approved_by = EXCLUDED.approved_by,
--     updated_at = NOW();

-- 2. 업로드 배치
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  record_date DATE,
  total_images INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE upload_batches
  ADD COLUMN IF NOT EXISTS season_key TEXT;
UPDATE upload_batches
SET season_key = '3th'
WHERE season_key IS NULL;
ALTER TABLE upload_batches
  ALTER COLUMN season_key SET DEFAULT '4th',
  ALTER COLUMN season_key SET NOT NULL;
ALTER TABLE upload_batches
  DROP CONSTRAINT IF EXISTS upload_batches_season_key_check;
ALTER TABLE upload_batches
  ADD CONSTRAINT upload_batches_season_key_check
  CHECK (season_key ~ '^[0-9]+th$') NOT VALID;

ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can insert own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can update own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can delete own upload batches" ON upload_batches;

REVOKE ALL ON TABLE upload_batches FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE upload_batches TO service_role;

CREATE INDEX IF NOT EXISTS idx_upload_batches_user_season_date
  ON upload_batches(user_id, season_key, record_date DESC, created_at DESC);

-- 3. 일일 러닝 인증 기록
CREATE TABLE IF NOT EXISTS daily_run_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
  record_date DATE,
  distance_km REAL,
  duration_seconds INTEGER,
  pace_seconds_per_km INTEGER,
  source_app TEXT,
  status TEXT DEFAULT 'needs_review' CHECK (status IN ('certified', 'needs_review', 'missing', 'rejected')),
  confidence_score REAL,
  image_url TEXT,
  raw_extracted_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE daily_run_records
  ADD COLUMN IF NOT EXISTS season_key TEXT;
UPDATE daily_run_records
SET season_key = '3th'
WHERE season_key IS NULL;
ALTER TABLE daily_run_records
  ALTER COLUMN season_key SET DEFAULT '4th',
  ALTER COLUMN season_key SET NOT NULL;
ALTER TABLE daily_run_records
  DROP CONSTRAINT IF EXISTS daily_run_records_season_key_check;
ALTER TABLE daily_run_records
  ADD CONSTRAINT daily_run_records_season_key_check
  CHECK (season_key ~ '^[0-9]+th$') NOT VALID;
ALTER TABLE daily_run_records
  DROP CONSTRAINT IF EXISTS daily_run_records_user_id_participant_id_record_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_run_records_season_participant_date
  ON daily_run_records(season_key, user_id, participant_id, record_date);

ALTER TABLE daily_run_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can insert own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can update own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can delete own daily run records" ON daily_run_records;

REVOKE ALL ON TABLE daily_run_records FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE daily_run_records TO service_role;

CREATE INDEX IF NOT EXISTS idx_daily_run_records_user_season_date
  ON daily_run_records(user_id, season_key, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_run_records_season_participant_date_lookup
  ON daily_run_records(season_key, participant_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_run_records_user_season_status
  ON daily_run_records(user_id, season_key, status);

-- 4. 개인 성장 뱃지 획득 이력
-- 한 번 획득한 뱃지는 기록 보정 이후에도 받은 상태로 유지합니다.
CREATE TABLE IF NOT EXISTS participant_growth_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  badge_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE participant_growth_badges
  ADD COLUMN IF NOT EXISTS season_key TEXT;
UPDATE participant_growth_badges
SET season_key = '3th'
WHERE season_key IS NULL;
ALTER TABLE participant_growth_badges
  ALTER COLUMN season_key SET DEFAULT '4th',
  ALTER COLUMN season_key SET NOT NULL;
ALTER TABLE participant_growth_badges
  DROP CONSTRAINT IF EXISTS participant_growth_badges_season_key_check;
ALTER TABLE participant_growth_badges
  ADD CONSTRAINT participant_growth_badges_season_key_check
  CHECK (season_key ~ '^[0-9]+th$') NOT VALID;
ALTER TABLE participant_growth_badges
  DROP CONSTRAINT IF EXISTS participant_growth_badges_user_id_participant_id_badge_key;
ALTER TABLE participant_growth_badges
  DROP CONSTRAINT IF EXISTS participant_growth_badges_user_id_participant_id_badge_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_growth_badges_season_participant_key
  ON participant_growth_badges(season_key, user_id, participant_id, badge_key);

ALTER TABLE participant_growth_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can insert own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can update own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can delete own participant growth badges" ON participant_growth_badges;

REVOKE ALL ON TABLE participant_growth_badges FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE participant_growth_badges TO service_role;

CREATE INDEX IF NOT EXISTS idx_participant_growth_badges_user_season_participant
  ON participant_growth_badges(user_id, season_key, participant_id, earned_at DESC);

-- 4-1. 승인 참가자의 일일 응원 상자 개봉 이력
-- 지급 권한과 랜덤 결과는 브라우저가 아니라 /api/me/gift-box 서버 경로에서 결정합니다.
-- 오늘의 운세는 DB에 저장하지 않고 /api/me/fortune에서 인증 사용자와 KST 날짜를
-- 전용 서버 비밀값으로 HMAC해 계산하므로 별도 fortune 테이블을 만들지 않습니다.
CREATE TABLE IF NOT EXISTS daily_gift_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record_date DATE NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 80),
  claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(season_key, user_id, participant_id, record_date)
);

ALTER TABLE daily_gift_claims
  ADD COLUMN IF NOT EXISTS season_key TEXT DEFAULT '4th' NOT NULL;
ALTER TABLE daily_gift_claims
  DROP CONSTRAINT IF EXISTS daily_gift_claims_user_id_participant_id_record_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_gift_claims_season_participant_date
  ON daily_gift_claims(season_key, user_id, participant_id, record_date);

CREATE INDEX IF NOT EXISTS idx_daily_gift_claims_participant_date
  ON daily_gift_claims(participant_id, record_date DESC);

ALTER TABLE daily_gift_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE daily_gift_claims FROM anon;
REVOKE ALL ON TABLE daily_gift_claims FROM authenticated;
REVOKE ALL ON TABLE daily_gift_claims FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE daily_gift_claims TO service_role;

-- 4-2. 4기 교정운동 가능 일정과 신청
-- 통증·병원 이용 정보는 민감한 건강 관련 정보이므로 브라우저 Data API에서
-- 직접 읽거나 쓰지 않습니다. 본인/운영자 권한을 확인한 Next.js 서버 API만
-- service_role로 접근하고, 응답/서버 로그에는 필요한 범위 밖의 원문을 남기지 않습니다.
CREATE TABLE IF NOT EXISTS corrective_exercise_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  slot_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE,
  capacity SMALLINT DEFAULT 1 NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (end_time IS NULL OR end_time > start_time),
  UNIQUE(user_id, season_key, slot_date, start_time)
);

CREATE TABLE IF NOT EXISTS corrective_exercise_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE RESTRICT NOT NULL,
  participant_name_snapshot TEXT NOT NULL CHECK (
    char_length(participant_name_snapshot) BETWEEN 1 AND 40
    AND btrim(participant_name_snapshot) <> ''
  ),
  requested_slot_id UUID REFERENCES corrective_exercise_slots(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL,
  requested_start_time TIME WITHOUT TIME ZONE NOT NULL,
  requested_end_time TIME WITHOUT TIME ZONE,
  pain_areas TEXT[] NOT NULL CHECK (
    cardinality(pain_areas) BETWEEN 1 AND 5
    AND array_position(pain_areas, NULL) IS NULL
    AND pain_areas <@ ARRAY[
      'neck', 'shoulder', 'upper_back', 'lower_back', 'hip',
      'knee', 'ankle', 'foot', 'elbow_wrist', 'other'
    ]::TEXT[]
  ),
  pain_context TEXT NOT NULL CHECK (char_length(pain_context) BETWEEN 10 AND 500),
  hospital_status TEXT NOT NULL CHECK (hospital_status IN ('none', 'past', 'current')),
  hospital_note TEXT CHECK (hospital_note IS NULL OR char_length(hospital_note) BETWEEN 1 AND 300),
  additional_note TEXT CHECK (additional_note IS NULL OR char_length(additional_note) BETWEEN 1 AND 500),
  status TEXT DEFAULT 'submitted' NOT NULL CHECK (
    status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed', 'completed', 'cancelled', 'rejected')
  ),
  confirmed_for TIMESTAMPTZ,
  admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) BETWEEN 1 AND 500),
  consent_version TEXT NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 64),
  consented_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '180 days') NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (requested_end_time IS NULL OR requested_end_time > requested_start_time),
  CHECK (retention_until > created_at)
);

-- 상세 열람 감사 로그에는 문진 원문이나 이름을 복제하지 않습니다.
-- application_id는 만료 신청 삭제 후에도 최소 감사 증적으로 남길 수 있도록 FK를 두지 않습니다.
CREATE TABLE IF NOT EXISTS corrective_exercise_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  operator_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('detail_viewed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '365 days') NOT NULL,
  CHECK (retention_until > created_at)
);

CREATE INDEX IF NOT EXISTS idx_corrective_exercise_slots_schedule
  ON corrective_exercise_slots(user_id, season_key, active, slot_date, start_time);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_admin
  ON corrective_exercise_applications(user_id, season_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_member
  ON corrective_exercise_applications(auth_user_id, season_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_slot
  ON corrective_exercise_applications(requested_slot_id, status, retention_until);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_retention
  ON corrective_exercise_applications(retention_until);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_audit_application
  ON corrective_exercise_audit_logs(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_audit_retention
  ON corrective_exercise_audit_logs(retention_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrective_exercise_one_active_per_member
  ON corrective_exercise_applications(season_key, auth_user_id)
  WHERE status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed');

-- 접수 중 데이터도 생성 후 180일을 넘기지 않고, 취소·거절·완료된 신청은
-- 상태 변경 시점부터 90일 이내로 보관 기한을 단축합니다. 이미 더 이른 기한은 늘리지 않습니다.
CREATE OR REPLACE FUNCTION public.set_corrective_exercise_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.retention_until := LEAST(
    COALESCE(NEW.retention_until, NEW.created_at + INTERVAL '180 days'),
    NEW.created_at + INTERVAL '180 days'
  );

  IF TG_OP = 'UPDATE' THEN
    NEW.retention_until := LEAST(NEW.retention_until, OLD.retention_until);
    IF NEW.status IN ('completed', 'cancelled', 'rejected')
      AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.retention_until := LEAST(NEW.retention_until, NOW() + INTERVAL '90 days');
    END IF;
  ELSIF NEW.status IN ('completed', 'cancelled', 'rejected') THEN
    NEW.retention_until := LEAST(NEW.retention_until, NOW() + INTERVAL '90 days');
  END IF;

  IF NEW.status = 'cancelled' THEN
    NEW.confirmed_for := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_corrective_exercise_retention ON corrective_exercise_applications;
CREATE TRIGGER trg_set_corrective_exercise_retention
  BEFORE INSERT OR UPDATE OF status, retention_until, confirmed_for ON corrective_exercise_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_corrective_exercise_retention();

-- 운영자의 슬롯 수정도 신청 RPC와 같은 advisory lock을 사용합니다. 정원·활성·일정 변경이
-- 신청 삽입과 동시에 실행돼도 잠긴 행의 최신 신청 수를 기준으로 원자적으로 결정됩니다.
CREATE OR REPLACE FUNCTION public.update_corrective_exercise_slot(
  p_user_id UUID,
  p_season_key TEXT,
  p_slot_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_slot_date DATE,
  p_start_time TIME WITHOUT TIME ZONE,
  p_end_time TIME WITHOUT TIME ZONE,
  p_capacity INTEGER,
  p_active BOOLEAN,
  p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_slot public.corrective_exercise_slots%ROWTYPE;
  active_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('corrective-slot:' || p_slot_id::TEXT, 0));

  SELECT * INTO existing_slot
  FROM public.corrective_exercise_slots
  WHERE id = p_slot_id
    AND user_id = p_user_id
    AND season_key = p_season_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrective exercise slot not found' USING ERRCODE = 'P0002';
  END IF;
  IF existing_slot.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'corrective exercise slot changed' USING ERRCODE = '40001';
  END IF;
  IF p_slot_date IS NULL
    OR p_start_time IS NULL
    OR p_capacity IS NULL
    OR p_capacity NOT BETWEEN 1 AND 20
    OR p_active IS NULL
    OR (p_end_time IS NOT NULL AND p_end_time <= p_start_time)
    OR (p_note IS NOT NULL AND (char_length(p_note) < 1 OR char_length(p_note) > 120)) THEN
    RAISE EXCEPTION 'corrective exercise slot invalid' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO active_count
  FROM public.corrective_exercise_applications
  WHERE requested_slot_id = p_slot_id
    AND status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed')
    AND retention_until > NOW();

  IF (p_slot_date, p_start_time, p_end_time)
      IS DISTINCT FROM (existing_slot.slot_date, existing_slot.start_time, existing_slot.end_time)
    AND active_count > 0 THEN
    RAISE EXCEPTION 'corrective exercise slot bookings exist' USING ERRCODE = '23514';
  END IF;
  IF p_capacity < active_count THEN
    RAISE EXCEPTION 'corrective exercise slot capacity below bookings' USING ERRCODE = '23514';
  END IF;
  IF (p_slot_date, p_start_time)
      IS DISTINCT FROM (existing_slot.slot_date, existing_slot.start_time)
    AND (p_slot_date + p_start_time) <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul') THEN
    RAISE EXCEPTION 'corrective exercise slot past schedule' USING ERRCODE = '23514';
  END IF;

  UPDATE public.corrective_exercise_slots
  SET slot_date = p_slot_date,
      start_time = p_start_time,
      end_time = p_end_time,
      capacity = p_capacity,
      active = p_active,
      note = p_note,
      updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN p_slot_id;
END;
$$;

-- 슬롯 행을 잠그고 정원·중복 신청을 같은 트랜잭션에서 확인해 동시 신청도 정원을 넘지 않습니다.
CREATE OR REPLACE FUNCTION public.submit_corrective_exercise_application(
  p_user_id UUID,
  p_season_key TEXT,
  p_auth_user_id UUID,
  p_participant_id UUID,
  p_participant_name TEXT,
  p_slot_id UUID,
  p_pain_areas TEXT[],
  p_pain_context TEXT,
  p_hospital_status TEXT,
  p_hospital_note TEXT,
  p_additional_note TEXT,
  p_consent_version TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  selected_slot public.corrective_exercise_slots%ROWTYPE;
  active_count INTEGER;
  application_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('corrective-slot:' || p_slot_id::TEXT, 0));

  SELECT * INTO selected_slot
  FROM public.corrective_exercise_slots
  WHERE id = p_slot_id
    AND user_id = p_user_id
    AND season_key = p_season_key
    AND active = TRUE
    AND (slot_date + start_time) > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrective exercise slot unavailable' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participants
    WHERE id = p_participant_id
      AND user_id = p_user_id
      AND season_key = p_season_key
      AND active = TRUE
  ) THEN
    RAISE EXCEPTION 'corrective exercise participant unavailable' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participant_accounts
    WHERE auth_user_id = p_auth_user_id
      AND participant_id = p_participant_id
      AND season_key = p_season_key
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'corrective exercise participant account unavailable' USING ERRCODE = '23514';
  END IF;

  -- 만료된 민감정보는 새 신청을 막지 않도록 먼저 실제 삭제합니다.
  DELETE FROM public.corrective_exercise_applications
  WHERE auth_user_id = p_auth_user_id
    AND season_key = p_season_key
    AND retention_until <= NOW();

  IF EXISTS (
    SELECT 1 FROM public.corrective_exercise_applications
    WHERE auth_user_id = p_auth_user_id
      AND season_key = p_season_key
      AND status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed')
      AND retention_until > NOW()
  ) THEN
    RAISE EXCEPTION 'corrective exercise active application exists' USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*) INTO active_count
  FROM public.corrective_exercise_applications
  WHERE requested_slot_id = p_slot_id
    AND status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed')
    AND retention_until > NOW();

  IF active_count >= selected_slot.capacity THEN
    RAISE EXCEPTION 'corrective exercise slot unavailable' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.corrective_exercise_applications (
    user_id, season_key, auth_user_id, participant_id, participant_name_snapshot,
    requested_slot_id, requested_date, requested_start_time, requested_end_time,
    pain_areas, pain_context, hospital_status, hospital_note, additional_note,
    consent_version, consented_at
  ) VALUES (
    p_user_id, p_season_key, p_auth_user_id, p_participant_id, p_participant_name,
    selected_slot.id, selected_slot.slot_date, selected_slot.start_time, selected_slot.end_time,
    p_pain_areas, p_pain_context, p_hospital_status, p_hospital_note, p_additional_note,
    p_consent_version, NOW()
  ) RETURNING id INTO application_id;

  RETURN application_id;
END;
$$;

-- 앱 배포만으로 임의 스케줄러를 만들지 않습니다. 이 스키마 적용 후 운영자가
-- docs/migrations/2026-09-04-corrective-exercise-retention-cron.sql을 명시적으로 실행하면
-- Supabase pg_cron이 아래 만료행 삭제 함수를 하루 한 번 호출합니다.
CREATE OR REPLACE FUNCTION public.purge_expired_corrective_exercise_applications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  deleted_application_count INTEGER;
  deleted_audit_count INTEGER;
BEGIN
  DELETE FROM public.corrective_exercise_applications
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_application_count = ROW_COUNT;

  DELETE FROM public.corrective_exercise_audit_logs
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_audit_count = ROW_COUNT;

  RETURN deleted_application_count + deleted_audit_count;
END;
$$;

ALTER TABLE corrective_exercise_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_exercise_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_exercise_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE corrective_exercise_slots FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE corrective_exercise_applications FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE corrective_exercise_audit_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE corrective_exercise_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE corrective_exercise_applications TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE corrective_exercise_audit_logs TO service_role;
REVOKE ALL ON FUNCTION public.set_corrective_exercise_retention() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_corrective_exercise_applications() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_corrective_exercise_retention() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_corrective_exercise_applications() TO service_role;

-- 4-3. 4기 공개 응원글과 광고 배너
-- 공개 브라우저는 이 테이블을 직접 읽지 않고 /api/hello-2027/content만 사용합니다.
-- 운영 변경은 서명된 어드민 세션을 확인하는 서버 API만 service_role로 수행합니다.
CREATE TABLE IF NOT EXISTS hello_2027_encouragements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 120),
  display_order INTEGER DEFAULT 0 NOT NULL CHECK (display_order BETWEEN 0 AND 10000),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS hello_2027_banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  owner_name TEXT NOT NULL CHECK (char_length(owner_name) BETWEEN 1 AND 20),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 100),
  alt_text TEXT NOT NULL CHECK (char_length(alt_text) BETWEEN 1 AND 80),
  image_url TEXT NOT NULL CHECK (
    char_length(image_url) BETWEEN 1 AND 2048
    AND image_url !~ '[[:space:]]'
    AND position(chr(92) IN image_url) = 0
    AND (
      (image_url LIKE '/%' AND image_url NOT LIKE '//%' AND position('..' IN image_url) = 0)
      OR image_url ~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/'
    )
  ),
  mobile_focus TEXT DEFAULT 'center' NOT NULL CHECK (mobile_focus IN ('left', 'center', 'right')),
  display_order INTEGER DEFAULT 0 NOT NULL CHECK (display_order BETWEEN 0 AND 10000),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 참가자의 기존 nickname은 이전 기수 데이터일 수 있으므로 공개 소개로 재사용하지 않습니다.
-- 운영자가 4기용으로 명시해 저장한 행만 공개 API가 읽습니다.
CREATE TABLE IF NOT EXISTS hello_2027_profile_introductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  name_snapshot TEXT CHECK (
    name_snapshot IS NULL OR (char_length(name_snapshot) BETWEEN 1 AND 40 AND btrim(name_snapshot) <> '')
  ),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40 AND btrim(title) <> ''),
  body TEXT DEFAULT '' NOT NULL CHECK (char_length(body) <= 320),
  active BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, season_key, participant_id),
  CHECK (
    NOT active OR (
      name_snapshot IS NOT NULL
      AND btrim(name_snapshot) <> ''
      AND btrim(body) <> ''
    )
  )
);

ALTER TABLE hello_2027_banners
  ADD COLUMN IF NOT EXISTS mobile_focus TEXT DEFAULT 'center' NOT NULL;
ALTER TABLE hello_2027_banners
  DROP CONSTRAINT IF EXISTS hello_2027_banners_mobile_focus_check;
ALTER TABLE hello_2027_banners
  ADD CONSTRAINT hello_2027_banners_mobile_focus_check
  CHECK (mobile_focus IN ('left', 'center', 'right'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_hello_2027_encouragements_unique_message
  ON hello_2027_encouragements(user_id, season_key, lower(message));
CREATE INDEX IF NOT EXISTS idx_hello_2027_encouragements_public_order
  ON hello_2027_encouragements(user_id, season_key, active, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_hello_2027_banners_public_order
  ON hello_2027_banners(user_id, season_key, active, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_hello_2027_profile_introductions_public
  ON hello_2027_profile_introductions(user_id, season_key, active, updated_at DESC);

CREATE OR REPLACE FUNCTION enforce_hello_2027_content_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_count INTEGER;
  item_limit INTEGER;
BEGIN
  -- 같은 운영자·기수·콘텐츠 종류의 동시 등록도 상한을 넘지 않도록 직렬화합니다.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(TG_TABLE_NAME || ':' || NEW.user_id::text || ':' || NEW.season_key, 0)
  );

  IF TG_TABLE_NAME = 'hello_2027_encouragements' THEN
    SELECT count(*) INTO item_count
    FROM hello_2027_encouragements
    WHERE user_id = NEW.user_id
      AND season_key = NEW.season_key
      AND id <> NEW.id;
    item_limit := 56;
  ELSIF TG_TABLE_NAME = 'hello_2027_banners' THEN
    SELECT count(*) INTO item_count
    FROM hello_2027_banners
    WHERE user_id = NEW.user_id
      AND season_key = NEW.season_key
      AND id <> NEW.id;
    item_limit := 10;
  ELSE
    RAISE EXCEPTION 'Unsupported Hello 2027 content table';
  END IF;

  IF item_count >= item_limit THEN
    RAISE EXCEPTION 'Hello 2027 content limit exceeded'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hello_2027_encouragement_limit ON hello_2027_encouragements;
CREATE TRIGGER hello_2027_encouragement_limit
  BEFORE INSERT OR UPDATE OF user_id, season_key ON hello_2027_encouragements
  FOR EACH ROW EXECUTE FUNCTION enforce_hello_2027_content_limit();
DROP TRIGGER IF EXISTS hello_2027_banner_limit ON hello_2027_banners;
CREATE TRIGGER hello_2027_banner_limit
  BEFORE INSERT OR UPDATE OF user_id, season_key ON hello_2027_banners
  FOR EACH ROW EXECUTE FUNCTION enforce_hello_2027_content_limit();

CREATE OR REPLACE FUNCTION enforce_hello_2027_profile_introduction_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('hello_2027_profile_introductions:' || NEW.user_id::text || ':' || NEW.season_key, 0)
  );
  SELECT count(*) INTO item_count
  FROM hello_2027_profile_introductions
  WHERE user_id = NEW.user_id
    AND season_key = NEW.season_key
    AND id <> NEW.id
    AND participant_id <> NEW.participant_id;
  IF item_count >= 100 THEN
    RAISE EXCEPTION 'Hello 2027 profile introduction limit exceeded'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hello_2027_profile_introduction_limit ON hello_2027_profile_introductions;
CREATE TRIGGER hello_2027_profile_introduction_limit
  BEFORE INSERT OR UPDATE OF user_id, season_key ON hello_2027_profile_introductions
  FOR EACH ROW EXECUTE FUNCTION enforce_hello_2027_profile_introduction_limit();

ALTER TABLE hello_2027_encouragements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hello_2027_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hello_2027_profile_introductions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE hello_2027_encouragements FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE hello_2027_banners FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE hello_2027_profile_introductions FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hello_2027_encouragements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hello_2027_banners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hello_2027_profile_introductions TO service_role;
REVOKE ALL ON FUNCTION enforce_hello_2027_profile_introduction_limit() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_hello_2027_profile_introduction_limit() TO service_role;

-- 4-3. 4기 댓글과 이모지 반응
CREATE TABLE IF NOT EXISTS hello_2027_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  parent_id UUID REFERENCES hello_2027_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 40),
  author_mode TEXT NOT NULL CHECK (author_mode IN ('random', 'kakao')),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_key TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 150),
  status TEXT DEFAULT 'visible' NOT NULL CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS hello_2027_comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  comment_id UUID REFERENCES hello_2027_comments(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '👏', '🌱', '🏃')),
  actor_key TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(comment_id, emoji, actor_key)
);

ALTER TABLE hello_2027_comment_reactions
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE hello_2027_comment_reactions
  DROP CONSTRAINT IF EXISTS hello_2027_comment_reactions_auth_user_id_fkey;
ALTER TABLE hello_2027_comment_reactions
  ADD CONSTRAINT hello_2027_comment_reactions_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 댓글 작성 이력으로 소유자를 확인할 수 있는 기존 Kakao 반응은 연결 정보를 복구합니다.
-- 댓글 없이 반응만 남긴 레거시 행은 자동 식별할 수 없으므로 운영 전 점검 쿼리로 확인합니다.
UPDATE hello_2027_comment_reactions AS reaction
SET auth_user_id = comment.auth_user_id
FROM hello_2027_comments AS comment
WHERE reaction.auth_user_id IS NULL
  AND comment.auth_user_id IS NOT NULL
  AND reaction.actor_key = comment.actor_key;

-- 기존 행은 운영자가 정리할 수 있도록 NOT VALID로 추가하고 신규·수정 행부터
-- 작성자 방식, 삭제 시각, 비식별 소유 키의 일관성을 강제합니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hello_2027_comments_author_consistency_check'
      AND conrelid = 'hello_2027_comments'::regclass
  ) THEN
    ALTER TABLE hello_2027_comments
      ADD CONSTRAINT hello_2027_comments_author_consistency_check
      CHECK (
        (author_mode = 'random' AND auth_user_id IS NULL)
        OR (author_mode = 'kakao' AND auth_user_id IS NOT NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hello_2027_comments_deleted_consistency_check'
      AND conrelid = 'hello_2027_comments'::regclass
  ) THEN
    ALTER TABLE hello_2027_comments
      ADD CONSTRAINT hello_2027_comments_deleted_consistency_check
      CHECK (
        (status = 'deleted' AND deleted_at IS NOT NULL)
        OR (status <> 'deleted' AND deleted_at IS NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hello_2027_comments_actor_key_length_check'
      AND conrelid = 'hello_2027_comments'::regclass
  ) THEN
    ALTER TABLE hello_2027_comments
      ADD CONSTRAINT hello_2027_comments_actor_key_length_check
      CHECK (char_length(actor_key) BETWEEN 16 AND 100) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hello_2027_reactions_actor_key_length_check'
      AND conrelid = 'hello_2027_comment_reactions'::regclass
  ) THEN
    ALTER TABLE hello_2027_comment_reactions
      ADD CONSTRAINT hello_2027_reactions_actor_key_length_check
      CHECK (char_length(actor_key) BETWEEN 16 AND 100) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hello_2027_reactions_auth_consistency_check'
      AND conrelid = 'hello_2027_comment_reactions'::regclass
  ) THEN
    ALTER TABLE hello_2027_comment_reactions
      ADD CONSTRAINT hello_2027_reactions_auth_consistency_check
      CHECK (
        (actor_key LIKE 'user:%' AND auth_user_id IS NOT NULL)
        OR (actor_key NOT LIKE 'user:%' AND auth_user_id IS NULL)
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hello_2027_comments_public
  ON hello_2027_comments(season_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hello_2027_comments_parent
  ON hello_2027_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_hello_2027_comment_reactions_comment
  ON hello_2027_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_hello_2027_comment_reactions_season_comment
  ON hello_2027_comment_reactions(season_key, comment_id);
CREATE INDEX IF NOT EXISTS idx_hello_2027_comment_reactions_auth_user
  ON hello_2027_comment_reactions(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 답글 작성은 부모 행을 잠근 뒤 개수를 검사해, 동시 요청에도 댓글당 50개를 넘지 않습니다.
CREATE OR REPLACE FUNCTION enforce_hello_2027_reply_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_season TEXT;
  parent_status TEXT;
  parent_parent_id UUID;
  visible_reply_count INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT season_key, status, parent_id
    INTO parent_season, parent_status, parent_parent_id
    FROM hello_2027_comments
    WHERE id = NEW.parent_id
    FOR UPDATE;

  IF NOT FOUND
    OR parent_parent_id IS NOT NULL
    OR parent_season <> NEW.season_key
    OR parent_status <> 'visible' THEN
    RAISE EXCEPTION 'hello_2027 reply parent is unavailable' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'visible' THEN
    SELECT COUNT(*)
      INTO visible_reply_count
      FROM hello_2027_comments
      WHERE season_key = NEW.season_key
        AND parent_id = NEW.parent_id
        AND status = 'visible'
        AND id <> NEW.id;
    IF visible_reply_count >= 50 THEN
      RAISE EXCEPTION 'hello_2027 reply limit exceeded' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_hello_2027_reply_limit ON hello_2027_comments;
CREATE TRIGGER trg_enforce_hello_2027_reply_limit
  BEFORE INSERT OR UPDATE OF parent_id, season_key, status ON hello_2027_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_hello_2027_reply_limit();

-- 반응 삽입 중 대상과 부모를 공유 잠금해 삭제/숨김과의 경쟁을 직렬화합니다.
CREATE OR REPLACE FUNCTION enforce_hello_2027_reaction_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_parent_id UUID;
  target_season TEXT;
  target_status TEXT;
  parent_status TEXT;
BEGIN
  SELECT parent_id, season_key, status
    INTO target_parent_id, target_season, target_status
    FROM hello_2027_comments
    WHERE id = NEW.comment_id
    FOR SHARE;

  IF NOT FOUND OR target_season <> NEW.season_key OR target_status <> 'visible' THEN
    RAISE EXCEPTION 'hello_2027 reaction target is unavailable' USING ERRCODE = '23514';
  END IF;

  IF target_parent_id IS NOT NULL THEN
    SELECT status
      INTO parent_status
      FROM hello_2027_comments
      WHERE id = target_parent_id
        AND season_key = NEW.season_key
        AND parent_id IS NULL
      FOR SHARE;
    IF NOT FOUND OR parent_status NOT IN ('visible', 'deleted') THEN
      RAISE EXCEPTION 'hello_2027 reaction parent is unavailable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_hello_2027_reaction_target ON hello_2027_comment_reactions;
CREATE TRIGGER trg_enforce_hello_2027_reaction_target
  BEFORE INSERT OR UPDATE OF season_key, comment_id ON hello_2027_comment_reactions
  FOR EACH ROW EXECUTE FUNCTION enforce_hello_2027_reaction_target();

-- 작성자 또는 운영자의 댓글 삭제를 한 트랜잭션으로 처리합니다. 댓글 행 잠금,
-- 소유권 확인, 비식별 치환, 반응 삭제가 중간 상태 없이 함께 완료됩니다.
CREATE OR REPLACE FUNCTION delete_hello_2027_comment(
  p_comment_id UUID,
  p_season_key TEXT,
  p_deleted_actor_key TEXT,
  p_expected_actor_key TEXT DEFAULT NULL,
  p_moderated_by UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_status TEXT;
  existing_actor_key TEXT;
  deleted_at_value TIMESTAMPTZ;
BEGIN
  SELECT status, actor_key
    INTO existing_status, existing_actor_key
    FROM hello_2027_comments
    WHERE id = p_comment_id
      AND season_key = p_season_key
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF existing_status <> 'deleted'
    AND p_expected_actor_key IS NOT NULL
    AND existing_actor_key <> p_expected_actor_key THEN
    RETURN 'not_found';
  END IF;

  DELETE FROM hello_2027_comment_reactions
  WHERE comment_id = p_comment_id
    AND season_key = p_season_key;

  IF existing_status = 'deleted' THEN
    RETURN 'deleted';
  END IF;

  deleted_at_value := NOW();
  UPDATE hello_2027_comments
  SET author_name = '삭제된 작성자',
      author_mode = 'random',
      auth_user_id = NULL,
      actor_key = p_deleted_actor_key,
      body = '삭제된 댓글입니다.',
      status = 'deleted',
      deleted_at = deleted_at_value,
      moderated_by = p_moderated_by,
      updated_at = deleted_at_value
  WHERE id = p_comment_id
    AND season_key = p_season_key;

  RETURN 'deleted';
END;
$$;

ALTER TABLE hello_2027_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hello_2027_comment_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE hello_2027_comments FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE hello_2027_comment_reactions FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hello_2027_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hello_2027_comment_reactions TO service_role;
REVOKE ALL ON FUNCTION enforce_hello_2027_reply_limit() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION enforce_hello_2027_reaction_target() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION delete_hello_2027_comment(UUID, TEXT, TEXT, TEXT, UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_hello_2027_reply_limit() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_hello_2027_reaction_target() TO service_role;
GRANT EXECUTE ON FUNCTION delete_hello_2027_comment(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

-- Supabase Auth 사용자가 탈퇴할 때 Kakao 댓글의 FK를 단순히 NULL로 만들면
-- author_mode 일관성 제약과 충돌합니다. Auth 행이 지워지기 전에 댓글을
-- 비식별 작성자로 바꾸고, 같은 actor_key로 남긴 반응도 함께 제거합니다.
CREATE OR REPLACE FUNCTION public.anonymize_hello_2027_comments_on_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  DELETE FROM public.hello_2027_comment_reactions
  WHERE auth_user_id = OLD.id
    OR actor_key IN (
      SELECT actor_key
      FROM public.hello_2027_comments
      WHERE auth_user_id = OLD.id
    );

  UPDATE public.hello_2027_comments
  SET author_name = '탈퇴한 이용자',
      author_mode = 'random',
      auth_user_id = NULL,
      actor_key = 'deleted:' || replace(id::text, '-', ''),
      updated_at = NOW()
  WHERE auth_user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_anonymize_hello_2027_comments_on_auth_delete ON auth.users;
CREATE TRIGGER trg_anonymize_hello_2027_comments_on_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.anonymize_hello_2027_comments_on_auth_delete();

REVOKE ALL ON FUNCTION public.anonymize_hello_2027_comments_on_auth_delete() FROM anon, authenticated, PUBLIC;

-- 운영 데이터의 user_id는 소유 운영자 식별자입니다. 운영자 Auth 계정을
-- 실수로 삭제해도 시즌 데이터가 연쇄 삭제되지 않도록 삭제를 명시적으로 막습니다.
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE participants
  ADD CONSTRAINT participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE upload_batches DROP CONSTRAINT IF EXISTS upload_batches_user_id_fkey;
ALTER TABLE upload_batches
  ADD CONSTRAINT upload_batches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE daily_run_records DROP CONSTRAINT IF EXISTS daily_run_records_user_id_fkey;
ALTER TABLE daily_run_records
  ADD CONSTRAINT daily_run_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE participant_growth_badges DROP CONSTRAINT IF EXISTS participant_growth_badges_user_id_fkey;
ALTER TABLE participant_growth_badges
  ADD CONSTRAINT participant_growth_badges_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE daily_gift_claims DROP CONSTRAINT IF EXISTS daily_gift_claims_user_id_fkey;
ALTER TABLE daily_gift_claims
  ADD CONSTRAINT daily_gift_claims_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE hello_2027_encouragements DROP CONSTRAINT IF EXISTS hello_2027_encouragements_user_id_fkey;
ALTER TABLE hello_2027_encouragements
  ADD CONSTRAINT hello_2027_encouragements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE hello_2027_banners DROP CONSTRAINT IF EXISTS hello_2027_banners_user_id_fkey;
ALTER TABLE hello_2027_banners
  ADD CONSTRAINT hello_2027_banners_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE hello_2027_profile_introductions DROP CONSTRAINT IF EXISTS hello_2027_profile_introductions_user_id_fkey;
ALTER TABLE hello_2027_profile_introductions
  ADD CONSTRAINT hello_2027_profile_introductions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 5. Storage: 인증 이미지 저장 버킷
-- Supabase Dashboard > Storage > New bucket
-- 이름: photos
-- Public: OFF 권장
-- 파일 크기 제한: 운영 정책에 맞게 설정

-- 6. 대시보드 갱신
-- 공개 Kakao 세션이 운영 테이블 변경 스트림을 직접 구독하지 않도록 Realtime은 켜지 않습니다.
-- 관리자 변경 후 서버 캐시 무효화와 공개 화면의 주기적 재조회로 최신 상태를 반영합니다.

-- 7. Storage: 스내사 포토로그 버킷
-- Supabase Dashboard > Storage에 아래 버킷을 만들고, 날짜가 들어간 폴더 안에 사진을 올리면
-- 대시보드가 자동으로 날짜별 사진첩을 구성합니다.
-- 권장 폴더명 예시: 2026-05-16 스내사 남산런 / 0516 스내사 남산런
INSERT INTO storage.buckets (id, name, public)
VALUES ('snasa-gallery', 'snasa-gallery', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

COMMIT;
