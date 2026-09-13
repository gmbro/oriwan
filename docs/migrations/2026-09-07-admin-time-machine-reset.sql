-- 기존 목표 타임머신 테이블에 관리자 재설정(삭제) 권한을 추가합니다.
-- 브라우저 역할에는 어떤 권한도 부여하지 않고, 관리자 권한을 재검증하는 서버 API만 사용합니다.
BEGIN;

REVOKE ALL ON TABLE public.time_machine_goals FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.time_machine_goals TO service_role;

COMMENT ON TABLE public.time_machine_goals IS
  'TWTT 4기 목표 캡슐. 개인 API의 목표 본문 공개는 고정 KST 개봉 시각으로 강제하고, OTP 인증 관리자는 운영 목적으로 확인·재설정한다.';

COMMIT;
NOTIFY pgrst, 'reload schema';
