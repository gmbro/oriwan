-- =============================================
-- 스내사 운영 DB 보안 하드닝
-- Supabase Dashboard > SQL Editor에서 docs/supabase-schema.sql 적용 후 실행하세요.
-- =============================================

BEGIN;

-- 1. 외부에 노출되는 public 스키마 테이블은 RLS를 반드시 켭니다.
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_run_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_growth_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_gift_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_fortune_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_change_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hello_2027_encouragements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hello_2027_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hello_2027_profile_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hello_2027_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hello_2027_comment_reactions ENABLE ROW LEVEL SECURITY;

-- 2. anon/public 역할의 직접 Data API 접근을 제거합니다.
--    공개 대시보드는 Next.js 서버 API가 service key로 필요한 필드만 읽습니다.
REVOKE ALL ON TABLE public.participants FROM anon;
REVOKE ALL ON TABLE public.upload_batches FROM anon;
REVOKE ALL ON TABLE public.daily_run_records FROM anon;
REVOKE ALL ON TABLE public.participant_growth_badges FROM anon;
REVOKE ALL ON TABLE public.participants FROM PUBLIC;
REVOKE ALL ON TABLE public.upload_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.daily_run_records FROM PUBLIC;
REVOKE ALL ON TABLE public.participant_growth_badges FROM PUBLIC;
REVOKE ALL ON TABLE public.participant_accounts FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.daily_gift_claims FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.daily_fortune_usage FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_slots FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_applications FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_audit_logs FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_change_audit_logs FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.hello_2027_encouragements FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.hello_2027_banners FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.hello_2027_profile_introductions FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.hello_2027_comments FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.hello_2027_comment_reactions FROM anon, authenticated, PUBLIC;

-- 3. 공개 카카오 사용자는 Supabase Data API로 운영 데이터를 직접 쓰지 못합니다.
--    모든 공개 조회·댓글·응원 상자·관리자 변경은 권한을 재검증하는 서버 API만 통과합니다.
REVOKE ALL ON TABLE public.participants FROM authenticated;
REVOKE ALL ON TABLE public.upload_batches FROM authenticated;
REVOKE ALL ON TABLE public.daily_run_records FROM authenticated;
REVOKE ALL ON TABLE public.participant_growth_badges FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.upload_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_run_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participant_growth_badges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participant_accounts TO service_role;
REVOKE UPDATE, DELETE ON TABLE public.daily_gift_claims FROM service_role;
GRANT SELECT, INSERT ON TABLE public.daily_gift_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_fortune_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.corrective_exercise_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.corrective_exercise_applications TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.corrective_exercise_audit_logs TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.corrective_exercise_change_audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hello_2027_encouragements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hello_2027_banners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hello_2027_profile_introductions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hello_2027_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hello_2027_comment_reactions TO service_role;
REVOKE ALL ON FUNCTION public.enforce_hello_2027_reply_limit() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_hello_2027_reaction_target() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_hello_2027_profile_introduction_limit() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.delete_hello_2027_comment(UUID, TEXT, TEXT, TEXT, UUID) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.anonymize_hello_2027_comments_on_auth_delete() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_daily_fortune_usage(UUID, DATE, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.release_daily_fortune_usage(UUID, DATE) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_corrective_exercise_retention() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.create_corrective_exercise_slot_audited(
  UUID, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_corrective_exercise_application_member(
  UUID, TEXT, UUID, UUID, UUID
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_corrective_exercise_applications() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.delete_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ
) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_hello_2027_reply_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_hello_2027_reaction_target() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_hello_2027_profile_introduction_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_hello_2027_comment(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_fortune_usage(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_daily_fortune_usage(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_corrective_exercise_retention() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_corrective_exercise_slot_audited(
  UUID, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_corrective_exercise_application_member(
  UUID, TEXT, UUID, UUID, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_corrective_exercise_applications() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ
) TO service_role;

-- 4. 공개 브라우저에서 DB 변경 스트림을 직접 구독하지 않도록 Realtime publication에서 제외합니다.
DO $$
DECLARE
  protected_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH protected_table IN ARRAY ARRAY[
      'participants',
      'upload_batches',
      'daily_run_records',
      'participant_growth_badges',
      'participant_accounts',
      'daily_gift_claims',
      'daily_fortune_usage',
      'corrective_exercise_slots',
      'corrective_exercise_applications',
      'corrective_exercise_audit_logs',
      'corrective_exercise_change_audit_logs',
      'hello_2027_encouragements',
      'hello_2027_banners',
      'hello_2027_profile_introductions',
      'hello_2027_comments',
      'hello_2027_comment_reactions'
    ]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = protected_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', protected_table);
      END IF;
    END LOOP;
  END IF;
END $$;

-- 5. 인증 이미지 버킷은 공개 버킷으로 두지 않습니다.
UPDATE storage.buckets
SET public = false
WHERE id IN ('photos', 'snasa-gallery');

-- 버킷의 public 플래그만으로는 기존 storage.objects 허용 정책이 사라지지 않습니다.
-- RESTRICTIVE 정책은 다른 PERMISSIVE 정책이 남아 있어도 두 보호 버킷에 대한
-- anon/authenticated의 SELECT/INSERT/UPDATE/DELETE를 마지막 단계에서 모두 막습니다.
DROP POLICY IF EXISTS "TWTT protected buckets deny browser access" ON storage.objects;
CREATE POLICY "TWTT protected buckets deny browser access"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id NOT IN ('photos', 'snasa-gallery'))
  WITH CHECK (bucket_id NOT IN ('photos', 'snasa-gallery'));

COMMIT;

-- 점검용 쿼리
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'participants', 'upload_batches', 'daily_run_records', 'participant_growth_badges',
--     'participant_accounts', 'daily_gift_claims', 'daily_fortune_usage', 'hello_2027_encouragements',
--     'corrective_exercise_slots', 'corrective_exercise_applications', 'corrective_exercise_audit_logs',
--     'corrective_exercise_change_audit_logs',
--     'hello_2027_banners', 'hello_2027_profile_introductions',
--     'hello_2027_comments', 'hello_2027_comment_reactions'
--   );
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'participants', 'upload_batches', 'daily_run_records', 'participant_growth_badges',
--     'participant_accounts', 'daily_gift_claims', 'daily_fortune_usage', 'hello_2027_encouragements',
--     'corrective_exercise_slots', 'corrective_exercise_applications', 'corrective_exercise_audit_logs',
--     'corrective_exercise_change_audit_logs',
--     'hello_2027_banners', 'hello_2027_profile_introductions',
--     'hello_2027_comments', 'hello_2027_comment_reactions'
--   )
-- ORDER BY table_name, grantee, privilege_type;
--
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
-- ORDER BY policyname;
-- 위 결과에서 "TWTT protected buckets deny browser access"가 RESTRICTIVE로 존재하는지 확인하고,
-- 실제 anon/Kakao JWT로 두 버킷의 SELECT/INSERT/UPDATE/DELETE가 모두 거부되는지 시험합니다.
--
-- SELECT COUNT(*) AS unidentified_kakao_reactions
-- FROM public.hello_2027_comment_reactions
-- WHERE actor_key LIKE 'user:%'
--   AND auth_user_id IS NULL;
-- 댓글 기능을 열기 전에 위 결과가 반드시 0인지 확인합니다. 0이 아니면 작성자와 연결할 수
-- 없는 레거시 반응이므로 백업 후 해당 행을 삭제하고 일관성 제약을 VALIDATE합니다.
