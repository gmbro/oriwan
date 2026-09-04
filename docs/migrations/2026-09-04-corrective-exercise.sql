-- TWTT 4기 교정운동 신청 전용 비파괴 마이그레이션
-- 새 테이블·인덱스·함수·권한만 추가합니다. Supabase SQL Editor에서 한 번 실행하세요.
BEGIN;

CREATE TABLE IF NOT EXISTS public.corrective_exercise_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  slot_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE,
  capacity SMALLINT DEFAULT 1 NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (end_time IS NULL OR end_time > start_time),
  UNIQUE(user_id, season_key, slot_date, start_time)
);

CREATE TABLE IF NOT EXISTS public.corrective_exercise_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  season_key TEXT DEFAULT '4th' NOT NULL CHECK (season_key ~ '^[0-9]+th$'),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT NOT NULL,
  participant_name_snapshot TEXT NOT NULL CHECK (
    char_length(participant_name_snapshot) BETWEEN 1 AND 40
    AND btrim(participant_name_snapshot) <> ''
  ),
  requested_slot_id UUID REFERENCES public.corrective_exercise_slots(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL,
  requested_start_time TIME WITHOUT TIME ZONE NOT NULL,
  requested_end_time TIME WITHOUT TIME ZONE,
  pain_areas TEXT[] NOT NULL CHECK (
    cardinality(pain_areas) BETWEEN 1 AND 5
    AND array_position(pain_areas, NULL) IS NULL
    AND pain_areas <@ ARRAY[
      'neck', 'shoulder', 'upper_back', 'lower_back', 'hip',
      'knee', 'ankle', 'foot', 'elbow_wrist', 'other'
    ]::TEXT[]
  ),
  pain_context TEXT NOT NULL CHECK (char_length(pain_context) BETWEEN 10 AND 500),
  hospital_status TEXT NOT NULL CHECK (hospital_status IN ('none', 'past', 'current')),
  hospital_note TEXT CHECK (hospital_note IS NULL OR char_length(hospital_note) BETWEEN 1 AND 300),
  additional_note TEXT CHECK (additional_note IS NULL OR char_length(additional_note) BETWEEN 1 AND 500),
  status TEXT DEFAULT 'submitted' NOT NULL CHECK (
    status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed', 'completed', 'cancelled', 'rejected')
  ),
  confirmed_for TIMESTAMPTZ,
  admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) BETWEEN 1 AND 500),
  consent_version TEXT NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 64),
  consented_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '180 days') NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (requested_end_time IS NULL OR requested_end_time > requested_start_time),
  CHECK (retention_until > created_at)
);

CREATE TABLE IF NOT EXISTS public.corrective_exercise_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  operator_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('detail_viewed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '365 days') NOT NULL,
  CHECK (retention_until > created_at)
);

CREATE INDEX IF NOT EXISTS idx_corrective_exercise_slots_schedule
  ON public.corrective_exercise_slots(user_id, season_key, active, slot_date, start_time);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_admin
  ON public.corrective_exercise_applications(user_id, season_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_member
  ON public.corrective_exercise_applications(auth_user_id, season_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_slot
  ON public.corrective_exercise_applications(requested_slot_id, status, retention_until);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_applications_retention
  ON public.corrective_exercise_applications(retention_until);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_audit_application
  ON public.corrective_exercise_audit_logs(user_id, application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_exercise_audit_retention
  ON public.corrective_exercise_audit_logs(retention_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrective_exercise_one_active_per_member
  ON public.corrective_exercise_applications(season_key, auth_user_id)
  WHERE status IN ('submitted', 'reviewing', 'schedule_proposed', 'confirmed');

CREATE OR REPLACE FUNCTION public.set_corrective_exercise_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.retention_until := LEAST(
    COALESCE(NEW.retention_until, NEW.created_at + INTERVAL '180 days'),
    NEW.created_at + INTERVAL '180 days'
  );

  IF TG_OP = 'UPDATE' THEN
    NEW.retention_until := LEAST(NEW.retention_until, OLD.retention_until);
    IF NEW.status IN ('completed', 'cancelled', 'rejected')
      AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.retention_until := LEAST(NEW.retention_until, NOW() + INTERVAL '90 days');
    END IF;
  ELSIF NEW.status IN ('completed', 'cancelled', 'rejected') THEN
    NEW.retention_until := LEAST(NEW.retention_until, NOW() + INTERVAL '90 days');
  END IF;

  IF NEW.status = 'cancelled' THEN
    NEW.confirmed_for := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_corrective_exercise_retention ON public.corrective_exercise_applications;
CREATE TRIGGER trg_set_corrective_exercise_retention
  BEFORE INSERT OR UPDATE OF status, retention_until, confirmed_for ON public.corrective_exercise_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_corrective_exercise_retention();

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

  UPDATE public.corrective_exercise_slots
  SET slot_date = p_slot_date,
      start_time = p_start_time,
      end_time = p_end_time,
      capacity = p_capacity,
      active = p_active,
      note = p_note,
      updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN p_slot_id;
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

CREATE OR REPLACE FUNCTION public.purge_expired_corrective_exercise_applications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  deleted_application_count INTEGER;
  deleted_audit_count INTEGER;
BEGIN
  DELETE FROM public.corrective_exercise_applications
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_application_count = ROW_COUNT;

  DELETE FROM public.corrective_exercise_audit_logs
  WHERE retention_until <= NOW();
  GET DIAGNOSTICS deleted_audit_count = ROW_COUNT;

  RETURN deleted_application_count + deleted_audit_count;
END;
$$;

ALTER TABLE public.corrective_exercise_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_exercise_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.corrective_exercise_slots FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_applications FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.corrective_exercise_audit_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.corrective_exercise_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.corrective_exercise_applications TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.corrective_exercise_audit_logs TO service_role;
REVOKE ALL ON FUNCTION public.set_corrective_exercise_retention() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_corrective_exercise_applications() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_corrective_exercise_retention() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_corrective_exercise_slot(
  UUID, TEXT, UUID, TIMESTAMPTZ, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, INTEGER, BOOLEAN, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_corrective_exercise_application(
  UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_corrective_exercise_applications() TO service_role;

COMMIT;

-- 운영 전 별도 작업: `docs/migrations/2026-09-04-corrective-exercise-retention-cron.sql`을
-- 명시적으로 실행해 만료행 파기 작업을 연결합니다. 앱 배포만으로는 스케줄을 만들지 않습니다.
