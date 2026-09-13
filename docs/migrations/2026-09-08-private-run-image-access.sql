-- Existing photos/snasa-gallery buckets and their restrictive policy are
-- already private in production. Preserve every file, path and public proxy.
-- Add an explicit deny for member uploads, even if a permissive policy is
-- introduced later. Application routes use service access after ownership checks.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'member-run-uploads' AND public = false) THEN
    RAISE EXCEPTION 'Expected existing private member-run-uploads bucket';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'TWTT private member uploads deny browser access'
  ) THEN
    CREATE POLICY "TWTT private member uploads deny browser access"
      ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
      USING (bucket_id <> 'member-run-uploads')
      WITH CHECK (bucket_id <> 'member-run-uploads');
  END IF;
END $$;

COMMIT;
