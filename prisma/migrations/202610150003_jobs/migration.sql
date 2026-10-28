-- Defined here to keep SQL in the Prisma migration history. Schedule only after deployment.
CREATE OR REPLACE FUNCTION public.lowkey_run_jobs() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE endpoint text; bearer text;
BEGIN
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='lowkey_jobs_url' LIMIT 1;
 SELECT decrypted_secret INTO bearer FROM vault.decrypted_secrets WHERE name='lowkey_job_secret' LIMIT 1;
 IF endpoint IS NULL OR bearer IS NULL THEN RAISE EXCEPTION 'Lowkey job secrets are not configured'; END IF;
 PERFORM net.http_post(url:=endpoint, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||bearer), body:='{}'::jsonb,timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.lowkey_run_jobs() FROM PUBLIC;
