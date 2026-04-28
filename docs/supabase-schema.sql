-- =============================================
-- 오리완 Supabase 보안 강화 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- =============================================

-- 1. completions 테이블 생성 (이미 있으면 무시)
CREATE TABLE IF NOT EXISTS completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL,
  distance REAL,
  moving_time INTEGER,
  average_cadence REAL,
  average_heartrate REAL,
  strava_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, completed_date)
);

-- 2. RLS (Row Level Security) 활성화
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Users can read own completions" ON completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON completions;
DROP POLICY IF EXISTS "Users can update own completions" ON completions;
DROP POLICY IF EXISTS "Users can delete own completions" ON completions;

-- 4. RLS 정책 재생성 — 본인 데이터만 접근 가능
CREATE POLICY "Users can read own completions"
  ON completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completions"
  ON completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions"
  ON completions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own completions"
  ON completions FOR DELETE
  USING (auth.uid() = user_id);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_completions_user_date 
  ON completions(user_id, completed_date);

-- 6. anon 역할의 직접 접근 차단 (서버 API만 사용)
-- service_role 키로만 접근 가능하도록 추가 보호
-- 이미 RLS가 auth.uid()를 확인하므로,
-- 비로그인 사용자(anon)는 어떤 데이터도 볼 수 없습니다.

-- =============================================
-- 확인: RLS가 제대로 적용되었는지 테스트
-- =============================================
-- Supabase SQL Editor에서 아래를 실행:
-- SELECT * FROM completions;
-- → 본인 데이터만 보여야 합니다.
-- → 비로그인 상태에서는 0건이어야 합니다.
