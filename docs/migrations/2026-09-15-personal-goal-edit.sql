-- Local development migration. Apply before deploying the editable personal goal API.
-- No goal data is changed. RLS and the prohibition on anon/authenticated direct access remain.
GRANT UPDATE ON TABLE public.time_machine_goals TO service_role;
COMMENT ON TABLE public.time_machine_goals IS 'Private 100-day goals. Application APIs expose contents only to the authenticated author; no administrator read/reset API.';
