-- TWTT 4기 크루 자기소개 저장소
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.
-- 기존 참가자(participants)와 관리자(auth.users)를 참조하므로 두 테이블이 먼저 있어야 합니다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.hello_2027_profile_introductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  name_snapshot TEXT CHECK (
    name_snapshot IS NULL
    OR (char_length(name_snapshot) BETWEEN 1 AND 40 AND btrim(name_snapshot) <> '')
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

CREATE INDEX IF NOT EXISTS idx_hello_2027_profile_introductions_public
  ON public.hello_2027_profile_introductions(user_id, season_key, active, updated_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_hello_2027_profile_introduction_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'hello_2027_profile_introductions:' || NEW.user_id::text || ':' || NEW.season_key,
      0
    )
  );

  SELECT count(*) INTO item_count
  FROM public.hello_2027_profile_introductions
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

DROP TRIGGER IF EXISTS hello_2027_profile_introduction_limit
  ON public.hello_2027_profile_introductions;
CREATE TRIGGER hello_2027_profile_introduction_limit
  BEFORE INSERT OR UPDATE OF user_id, season_key
  ON public.hello_2027_profile_introductions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_hello_2027_profile_introduction_limit();

ALTER TABLE public.hello_2027_profile_introductions ENABLE ROW LEVEL SECURITY;

-- 공개 브라우저는 테이블을 직접 읽거나 쓰지 않고, 권한을 확인하는 서버 API만 사용합니다.
REVOKE ALL ON TABLE public.hello_2027_profile_introductions
  FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.hello_2027_profile_introductions
  TO service_role;

REVOKE ALL ON FUNCTION public.enforce_hello_2027_profile_introduction_limit()
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_hello_2027_profile_introduction_limit()
  TO service_role;

COMMIT;

-- 실행 확인:
-- SELECT to_regclass('public.hello_2027_profile_introductions') AS profile_introductions_table;
