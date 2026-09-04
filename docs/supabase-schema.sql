-- =============================================
-- 스내사 3기 이미지 인증 운영 대시보드 스키마
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 1. 참가자
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own participants" ON participants;
DROP POLICY IF EXISTS "Users can insert own participants" ON participants;
DROP POLICY IF EXISTS "Users can update own participants" ON participants;
DROP POLICY IF EXISTS "Users can delete own participants" ON participants;

CREATE POLICY "Users can read own participants"
  ON participants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own participants"
  ON participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participants"
  ON participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own participants"
  ON participants FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_participants_user_order
  ON participants(user_id, active, display_order, created_at);

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
-- 기존 기수의 승인 행은 자동으로 4기로 승격하지 않습니다. 운영자가 4기 계정
-- 연결을 다시 저장한 행에만 '4th'가 기록되어 개인 기능 권한으로 사용됩니다.
ALTER TABLE participant_accounts
  ADD COLUMN IF NOT EXISTS season_key TEXT;
ALTER TABLE participant_accounts
  ALTER COLUMN season_key SET DEFAULT '4th';
ALTER TABLE participant_accounts
  DROP CONSTRAINT IF EXISTS participant_accounts_season_key_check;
ALTER TABLE participant_accounts
  ADD CONSTRAINT participant_accounts_season_key_check
  CHECK (season_key IS NULL OR season_key ~ '^[0-9]+th$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_accounts_auth_user
  ON participant_accounts(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_accounts_participant
  ON participant_accounts(participant_id);
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
-- ON CONFLICT (auth_user_id) DO UPDATE
-- SET participant_id = EXCLUDED.participant_id,
--     season_key = EXCLUDED.season_key,
--     status = 'approved',
--     approved_at = NOW(),
--     approved_by = EXCLUDED.approved_by,
--     updated_at = NOW();

-- 2. 업로드 배치
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record_date DATE,
  total_images INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can insert own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can update own upload batches" ON upload_batches;
DROP POLICY IF EXISTS "Users can delete own upload batches" ON upload_batches;

CREATE POLICY "Users can read own upload batches"
  ON upload_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own upload batches"
  ON upload_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own upload batches"
  ON upload_batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own upload batches"
  ON upload_batches FOR DELETE USING (auth.uid() = user_id);

-- 3. 일일 러닝 인증 기록
CREATE TABLE IF NOT EXISTS daily_run_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, participant_id, record_date)
);

ALTER TABLE daily_run_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can insert own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can update own daily run records" ON daily_run_records;
DROP POLICY IF EXISTS "Users can delete own daily run records" ON daily_run_records;

CREATE POLICY "Users can read own daily run records"
  ON daily_run_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily run records"
  ON daily_run_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily run records"
  ON daily_run_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily run records"
  ON daily_run_records FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_run_records_user_date
  ON daily_run_records(user_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_run_records_participant_date
  ON daily_run_records(participant_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_run_records_status
  ON daily_run_records(user_id, status);

-- 4. 개인 성장 뱃지 획득 이력
-- 한 번 획득한 뱃지는 기록 보정 이후에도 받은 상태로 유지합니다.
CREATE TABLE IF NOT EXISTS participant_growth_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  badge_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, participant_id, badge_key)
);

ALTER TABLE participant_growth_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can insert own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can update own participant growth badges" ON participant_growth_badges;
DROP POLICY IF EXISTS "Users can delete own participant growth badges" ON participant_growth_badges;

CREATE POLICY "Users can read own participant growth badges"
  ON participant_growth_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own participant growth badges"
  ON participant_growth_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participant growth badges"
  ON participant_growth_badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own participant growth badges"
  ON participant_growth_badges FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_participant_growth_badges_user_participant
  ON participant_growth_badges(user_id, participant_id, earned_at DESC);

-- 4-1. 승인 참가자의 일일 응원 상자 개봉 이력
-- 지급 권한과 랜덤 결과는 브라우저가 아니라 /api/me/gift-box 서버 경로에서 결정합니다.
-- 오늘의 운세는 DB에 저장하지 않고 /api/me/fortune에서 인증 사용자와 KST 날짜를
-- 전용 서버 비밀값으로 HMAC해 계산하므로 별도 fortune 테이블을 만들지 않습니다.
CREATE TABLE IF NOT EXISTS daily_gift_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 5. Storage: 인증 이미지 저장 버킷
-- Supabase Dashboard > Storage > New bucket
-- 이름: photos
-- Public: OFF 권장
-- 파일 크기 제한: 운영 정책에 맞게 설정

-- 6. 실시간 대시보드
-- Supabase Dashboard > Database > Replication 또는 Realtime 설정에서
-- participants, daily_run_records 테이블의 Realtime을 켜면 입력/수정 즉시 화면이 갱신됩니다.
-- Realtime이 꺼져 있어도 웹 대시보드는 60초마다 자동으로 최신 데이터를 다시 가져옵니다.

-- 7. Storage: 스내사 포토로그 버킷
-- Supabase Dashboard > Storage에 아래 버킷을 만들고, 날짜가 들어간 폴더 안에 사진을 올리면
-- 대시보드가 자동으로 날짜별 사진첩을 구성합니다.
-- 권장 폴더명 예시: 2026-05-16 스내사 남산런 / 0516 스내사 남산런
INSERT INTO storage.buckets (id, name, public)
VALUES ('snasa-gallery', 'snasa-gallery', false)
ON CONFLICT (id) DO UPDATE
SET public = false;
