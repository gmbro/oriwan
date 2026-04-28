-- =============================================
-- 오리완 Supabase 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- =============================================

-- 오리완 완료 기록 테이블
CREATE TABLE IF NOT EXISTS completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL,
  distance REAL,                    -- 거리 (미터)
  moving_time INTEGER,              -- 이동 시간 (초)
  average_cadence REAL,             -- 평균 케이던스
  average_heartrate REAL,           -- 평균 심박수
  strava_activity_id BIGINT,        -- Strava 활동 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 같은 유저가 같은 날짜에 중복 기록 방지
  UNIQUE(user_id, completed_date)
);

-- RLS (Row Level Security) 활성화
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- 본인의 기록만 읽을 수 있도록
CREATE POLICY "Users can read own completions"
  ON completions FOR SELECT
  USING (auth.uid() = user_id);

-- 본인의 기록만 쓸 수 있도록
CREATE POLICY "Users can insert own completions"
  ON completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인의 기록만 업데이트(upsert) 할 수 있도록
CREATE POLICY "Users can update own completions"
  ON completions FOR UPDATE
  USING (auth.uid() = user_id);

-- 인덱스 (유저별 날짜 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_completions_user_date 
  ON completions(user_id, completed_date);
