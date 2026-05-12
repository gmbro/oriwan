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

-- 4. Storage: 인증 이미지 저장 버킷
-- Supabase Dashboard > Storage > New bucket
-- 이름: photos
-- Public: OFF 권장
-- 파일 크기 제한: 운영 정책에 맞게 설정

-- 5. 실시간 대시보드
-- Supabase Dashboard > Database > Replication 또는 Realtime 설정에서
-- participants, daily_run_records 테이블의 Realtime을 켜면 입력/수정 즉시 화면이 갱신됩니다.
-- Realtime이 꺼져 있어도 웹 대시보드는 60초마다 자동으로 최신 데이터를 다시 가져옵니다.
