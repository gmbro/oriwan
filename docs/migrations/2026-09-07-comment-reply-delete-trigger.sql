-- 삭제된 부모 댓글 아래의 답글도 작성자가 정상적으로 삭제할 수 있게 합니다.
-- 공개 답글을 새로 만들거나 다시 공개할 때는 기존처럼 공개 부모만 허용합니다.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_hello_2027_reply_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_season TEXT;
  parent_status TEXT;
  parent_parent_id UUID;
  visible_reply_count INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT season_key, status, parent_id
    INTO parent_season, parent_status, parent_parent_id
    FROM public.hello_2027_comments
    WHERE id = NEW.parent_id
    FOR UPDATE;

  IF NOT FOUND
    OR parent_parent_id IS NOT NULL
    OR parent_season <> NEW.season_key THEN
    RAISE EXCEPTION 'hello_2027 reply parent is unavailable' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'visible' THEN
    IF parent_status <> 'visible' THEN
      RAISE EXCEPTION 'hello_2027 reply parent is unavailable' USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)
      INTO visible_reply_count
      FROM public.hello_2027_comments
      WHERE season_key = NEW.season_key
        AND parent_id = NEW.parent_id
        AND status = 'visible'
        AND id <> NEW.id;
    IF visible_reply_count >= 50 THEN
      RAISE EXCEPTION 'hello_2027 reply limit exceeded' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_hello_2027_reply_limit() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_hello_2027_reply_limit() TO service_role;

COMMIT;
