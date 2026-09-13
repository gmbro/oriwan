-- Make approved legacy Kakao-linked 4th-season members visible on the shared dashboard.
--
-- Older application releases assigned display_order = -1 to every automatically
-- created participant. The application now reserves -1 for an unapproved or
-- revoked draft, so approved active connections can be moved to the automatic
-- public order. The -1 predicate makes this migration safe to run repeatedly.

BEGIN;

UPDATE public.participants AS participant
SET display_order = 10000
FROM public.participant_accounts AS account
WHERE account.participant_id = participant.id
  AND account.season_key = '4th'
  AND account.status = 'approved'
  AND participant.season_key = '4th'
  AND participant.active IS TRUE
  AND participant.display_order = -1;

COMMIT;
