-- TWTT 4기 교정운동 변경 감사·즉시 삭제 보강 마이그레이션
-- 반드시 `2026-09-04-corrective-exercise.sql` 다음에 실행하세요.
-- 건강 문진 원문은 감사 로그에 복제하지 않고 대상 UUID, 동작, 변경 필드명만 기록합니다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.corrective_exercise_change_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  actor_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'member', 'system')),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('slot', 'application')),
  target_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('slot_created', 'slot_updated', 'application_updated', 'application_cancelled', 'application_deleted')
  ),
  changed_fields TEXT[] DEFAULT '{}'::TEXT[] NOT NULL CHECK (
    array_position(changed_fields, NULL) IS NULL
    AND changed_fields <@ ARRAY[
      'slot_date', 'start_time', 'end_time', 'capacity', 'active', 'public_note',
      'status', 'confirmed_for', 'member_notice'
    ]::TEXT[]
  ),
  previous_status TEXT CHECK (
    previous_status IS NULL OR previous_status IN (
      'submitted', 'reviewing', 'schedule_proposed', 'confirmed', 'completed', 'cancelled', 'rejected'
    )
  ),
  next_status TEXT CHECK (
    next_status IS NULL OR next_status IN (
      'submitted', 'reviewing', 'schedule_proposed', 'confirmed', 'completed', 'cancelled', 'rejected'
    )
  ),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '365 days') NOT NULL,
  CHECK (retention_until > created_at)
);

CREATE INDEX IF NOT EXISTS idx_corrective_exercise_change_audit_target
  ON public.corrective_exercise_change_audit_logs(user_id, target_kind, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_change_audit_retention
  ON public.corrective_exercise_change_audit_logs(retention_until);

CREATE OR REPLACE FUNCTION public.create_corrective_exercise_slot_audited(
  p_user_id UUID,
  p_season_key TEXT,
  p_operator_auth_user_id UUID,
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
  slot_id UUID;
BEGIN
  IF p_slot_date IS NULL
    OR p_start_time IS NULL
    OR p_capacity IS NULL
    OR p_capacity NOT BETWEEN 1 AND 20
    OR p_active IS NULL
    OR (p_end_time IS NOT NULL AND p_end_time <= p_start_time)
    OR (p_note IS NOT NULL AND (char_length(p_note) < 1 OR char_length(p_note) > 120))
    OR (p_slot_date + p_start_time) <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul') THEN
    RAISE EXCEPTION 'corrective exercise slot invalid' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.corrective_exercise_slots (
    user_id, season_key, slot_date, start_time, end_time, capacity, active, note, updated_at
  ) VALUES (
    p_user_id, p_season_key, p_slot_date, p_start_time, p_end_time, p_capacity, p_active, p_note, NOW()
  ) RETURNING id INTO slot_id;

  INSERT INTO public.corrective_exercise_change_audit_logs (
    user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type, changed_fields
  ) VALUES (
    p_user_id,
    p_operator_auth_user_id,
    'admin',
    'slot',
    slot_id,
    'slot_created',
    ARRAY['slot_date', 'start_time', 'end_time', 'capacity', 'active', 'public_note']::TEXT[]
  );

  RETURN slot_id;
END;
$$;

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
  changed TEXT[];
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

  changed := array_remove(ARRAY[
    CASE WHEN p_slot_date IS DISTINCT FROM existing_slot.slot_date THEN 'slot_date' END,
    CASE WHEN p_start_time IS DISTINCT FROM existing_slot.start_time THEN 'start_time' END,
    CASE WHEN p_end_time IS DISTINCT FROM existing_slot.end_time THEN 'end_time' END,
    CASE WHEN p_capacity IS DISTINCT FROM existing_slot.capacity THEN 'capacity' END,
    CASE WHEN p_active IS DISTINCT FROM existing_slot.active THEN 'active' END,
    CASE WHEN p_note IS DISTINCT FROM existing_slot.note THEN 'public_note' END
  ]::TEXT[], NULL);

  UPDATE public.corrective_exercise_slots
  SET slot_date = p_slot_date,
      start_time = p_start_time,
      end_time = p_end_time,
      capacity = p_capacity,
      active = p_active,
      note = p_note,
      updated_at = NOW()
  WHERE id = p_slot_id;

  IF cardinality(changed) > 0 THEN
    INSERT INTO public.corrective_exercise_change_audit_logs (
      user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type, changed_fields
    ) VALUES (
      p_user_id, p_user_id, 'admin', 'slot', p_slot_id, 'slot_updated', changed
    );
  END IF;

  RETURN p_slot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_corrective_exercise_application_admin(
  p_user_id UUID,
  p_season_key TEXT,
  p_application_id UUID,
  p_operator_auth_user_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_expected_status TEXT,
  p_status TEXT,
  p_confirmed_for TIMESTAMPTZ,
  p_member_notice TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_application public.corrective_exercise_applications%ROWTYPE;
  changed TEXT[];
BEGIN
  SELECT * INTO existing_application
  FROM public.corrective_exercise_applications
  WHERE id = p_application_id
    AND user_id = p_user_id
    AND season_key = p_season_key
    AND retention_until > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrective exercise application not found' USING ERRCODE = 'P0002';
  END IF;
  IF existing_application.updated_at IS DISTINCT FROM p_expected_updated_at
    OR existing_application.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'corrective exercise application changed' USING ERRCODE = '40001';
  END IF;
  IF p_status NOT IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed', 'completed', 'cancelled', 'rejected')
    OR (p_member_notice IS NOT NULL AND (char_length(p_member_notice) < 1 OR char_length(p_member_notice) > 500)) THEN
    RAISE EXCEPTION 'corrective exercise application invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IS DISTINCT FROM existing_application.status AND NOT (
    (existing_application.status = 'submitted' AND p_status IN ('reviewing', 'schedule_proposed', 'confirmed', 'cancelled', 'rejected'))
    OR (existing_application.status = 'reviewing' AND p_status IN ('schedule_proposed', 'confirmed', 'cancelled', 'rejected'))
    OR (existing_application.status = 'schedule_proposed' AND p_status IN ('reviewing', 'confirmed', 'cancelled', 'rejected'))
    OR (existing_application.status = 'confirmed' AND p_status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'corrective exercise application transition invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IN ('schedule_proposed', 'confirmed') AND p_confirmed_for IS NULL THEN
    RAISE EXCEPTION 'corrective exercise confirmed schedule invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IN ('schedule_proposed', 'confirmed')
    AND (p_status IS DISTINCT FROM existing_application.status
      OR p_confirmed_for IS DISTINCT FROM existing_application.confirmed_for)
    AND p_confirmed_for <= NOW() THEN
    RAISE EXCEPTION 'corrective exercise confirmed schedule invalid' USING ERRCODE = '23514';
  END IF;

  changed := array_remove(ARRAY[
    CASE WHEN p_status IS DISTINCT FROM existing_application.status THEN 'status' END,
    CASE WHEN p_confirmed_for IS DISTINCT FROM existing_application.confirmed_for THEN 'confirmed_for' END,
    CASE WHEN p_member_notice IS DISTINCT FROM existing_application.admin_note THEN 'member_notice' END
  ]::TEXT[], NULL);

  UPDATE public.corrective_exercise_applications
  SET status = p_status,
      confirmed_for = CASE WHEN p_status = 'cancelled' THEN NULL ELSE p_confirmed_for END,
      admin_note = p_member_notice,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
      updated_at = NOW()
  WHERE id = p_application_id;

  IF cardinality(changed) > 0 THEN
    INSERT INTO public.corrective_exercise_change_audit_logs (
      user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type,
      changed_fields, previous_status, next_status
    ) VALUES (
      p_user_id, p_operator_auth_user_id, 'admin', 'application', p_application_id,
      'application_updated', changed, existing_application.status, p_status
    );
  END IF;

  RETURN p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_corrective_exercise_application_member(
  p_user_id UUID,
  p_season_key TEXT,
  p_application_id UUID,
  p_auth_user_id UUID,
  p_participant_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_application public.corrective_exercise_applications%ROWTYPE;
BEGIN
  SELECT * INTO existing_application
  FROM public.corrective_exercise_applications
  WHERE id = p_application_id
    AND user_id = p_user_id
    AND season_key = p_season_key
    AND auth_user_id = p_auth_user_id
    AND participant_id = p_participant_id
    AND status IN ('submitted', 'reviewing', 'schedule_proposed')
    AND retention_until > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrective exercise application not cancellable' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.corrective_exercise_applications
  SET status = 'cancelled', confirmed_for = NULL, cancelled_at = NOW(), updated_at = NOW()
  WHERE id = p_application_id;

  INSERT INTO public.corrective_exercise_change_audit_logs (
    user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type,
    changed_fields, previous_status, next_status
  ) VALUES (
    p_user_id, p_auth_user_id, 'member', 'application', p_application_id,
    'application_cancelled', ARRAY['status', 'confirmed_for']::TEXT[], existing_application.status, 'cancelled'
  );

  RETURN p_application_id;
END;
$$;

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

  INSERT INTO public.corrective_exercise_change_audit_logs (
    user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type,
    changed_fields, previous_status, next_status
  )
  SELECT
    user_id, NULL, 'system', 'application', id, 'application_deleted',
    '{}'::TEXT[], status, NULL
  FROM public.corrective_exercise_applications
  WHERE auth_user_id = p_auth_user_id
    AND season_key = p_season_key
    AND retention_until <= NOW();

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

CREATE OR REPLACE FUNCTION public.delete_corrective_exercise_application_admin(
  p_user_id UUID,
  p_season_key TEXT,
  p_application_id UUID,
  p_operator_auth_user_id UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_application public.corrective_exercise_applications%ROWTYPE;
BEGIN
  SELECT * INTO existing_application
  FROM public.corrective_exercise_applications
  WHERE id = p_application_id
    AND user_id = p_user_id
    AND season_key = p_season_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrective exercise application not found' USING ERRCODE = 'P0002';
  END IF;
  IF existing_application.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'corrective exercise application changed' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.corrective_exercise_change_audit_logs (
    user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type,
    changed_fields, previous_status, next_status
  ) VALUES (
    p_user_id, p_operator_auth_user_id, 'admin', 'application', p_application_id,
    'application_deleted', '{}'::TEXT[], existing_application.status, NULL
  );

  DELETE FROM public.corrective_exercise_applications
  WHERE id = p_application_id;

  RETURN p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_corrective_exercise_applications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  deleted_application_count INTEGER;
  deleted_read_audit_count INTEGER;
  deleted_change_audit_count INTEGER;
BEGIN
  INSERT INTO public.corrective_exercise_change_audit_logs (
    user_id, actor_auth_user_id, actor_role, target_kind, target_id, event_type,
    changed_fields, previous_status, next_status
  )
  SELECT
    user_id, NULL, 'system', 'application', id, 'application_deleted',
    '{}'::TEXT[], status, NULL
  FROM public.corrective_exercise_applications
  WHERE retention_until <= NOW();

  DELETE FROM public.corrective_exercise_applications
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_application_count = ROW_COUNT;

  DELETE FROM public.corrective_exercise_audit_logs
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_read_audit_count = ROW_COUNT;

  DELETE FROM public.corrective_exercise_change_audit_logs
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_change_audit_count = ROW_COUNT;

  RETURN deleted_application_count + deleted_read_audit_count + deleted_change_audit_count;
END;
$$;

ALTER TABLE public.corrective_exercise_change_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.corrective_exercise_change_audit_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.corrective_exercise_change_audit_logs TO service_role;

REVOKE ALL ON FUNCTION public.create_corrective_exercise_slot_audited(
  UUID, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
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
REVOKE ALL ON FUNCTION public.delete_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_corrective_exercise_applications() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_corrective_exercise_slot_audited(
  UUID, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
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
GRANT EXECUTE ON FUNCTION public.delete_corrective_exercise_application_admin(
  UUID, TEXT, UUID, UUID, TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_corrective_exercise_applications() TO service_role;

COMMIT;

-- 운영 검증(읽기 전용): 민감정보 원문 컬럼이 감사 테이블에 없는지 확인
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'corrective_exercise_change_audit_logs'
-- ORDER BY ordinal_position;
