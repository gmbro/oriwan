-- =============================================
-- 스내사 운영 DB 보안 하드닝
-- Supabase Dashboard > SQL Editor에서 docs/supabase-schema.sql 적용 후 실행하세요.
-- =============================================

BEGIN;

-- 1. 외부에 노출되는 public 스키마 테이블은 RLS를 반드시 켭니다.
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_run_records ENABLE ROW LEVEL SECURITY;

-- 2. anon/public 역할의 직접 Data API 접근을 제거합니다.
--    공개 대시보드는 Next.js 서버 API가 service key로 필요한 필드만 읽습니다.
REVOKE ALL ON TABLE public.participants FROM anon;
REVOKE ALL ON TABLE public.upload_batches FROM anon;
REVOKE ALL ON TABLE public.daily_run_records FROM anon;
REVOKE ALL ON TABLE public.participants FROM PUBLIC;
REVOKE ALL ON TABLE public.upload_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.daily_run_records FROM PUBLIC;

-- 3. 로그인한 사용자와 서버 전용 역할만 테이블을 사용할 수 있게 둡니다.
--    실제 행 접근은 docs/supabase-schema.sql의 auth.uid() = user_id RLS 정책이 제한합니다.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.upload_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_run_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.upload_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_run_records TO service_role;

-- 4. 공개 브라우저에서 DB 변경 스트림을 직접 구독하지 않도록 Realtime publication에서 제외합니다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'participants'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.participants';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'daily_run_records'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.daily_run_records';
    END IF;
  END IF;
END $$;

-- 5. 인증 이미지 버킷은 공개 버킷으로 두지 않습니다.
UPDATE storage.buckets
SET public = false
WHERE id IN ('photos', 'snasa-gallery');

COMMIT;

-- 점검용 쿼리
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('participants', 'upload_batches', 'daily_run_records');
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('participants', 'upload_batches', 'daily_run_records')
-- ORDER BY table_name, grantee, privilege_type;
