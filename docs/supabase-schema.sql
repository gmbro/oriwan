-- =============================================
-- 오리완 Supabase 스키마 + RLS + Storage
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 1. completions 테이블
CREATE TABLE IF NOT EXISTS completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL,
  distance REAL,
  moving_time INTEGER,
  average_cadence REAL,
  average_heartrate REAL,
  strava_activity_id BIGINT,
  photo_url TEXT,
  certified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, completed_date)
);

-- 2. RLS 활성화
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책
DROP POLICY IF EXISTS "Users can read own completions" ON completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON completions;
DROP POLICY IF EXISTS "Users can update own completions" ON completions;
DROP POLICY IF EXISTS "Users can delete own completions" ON completions;

CREATE POLICY "Users can read own completions"
  ON completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions"
  ON completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own completions"
  ON completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions"
  ON completions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_completions_user_date
  ON completions(user_id, completed_date);

-- =============================================
-- 기존 테이블에 새 컬럼 추가 (이미 테이블이 있는 경우)
-- =============================================
ALTER TABLE completions ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS certified BOOLEAN DEFAULT FALSE;

-- =============================================
-- Storage: 인증 사진 저장 버킷
-- ⚠️ 이건 SQL이 아니라 Supabase 대시보드에서 수동 생성해야 합니다!
--
-- 1. Supabase → Storage → New bucket
-- 2. 이름: photos
-- 3. Public: ON (공개 URL 필요)
-- 4. 파일 크기 제한: 5MB
-- =============================================
