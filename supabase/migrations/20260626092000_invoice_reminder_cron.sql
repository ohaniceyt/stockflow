-- Schedule daily automatic invoice reminders via pg_cron + pg_net.
-- The Edge Function send-auto-reminders expects an Authorization header with
-- a secret stored in SUPABASE secrets as AUTO_REMINDER_SECRET.

-- Ensure required extensions are available.
-- Schedule daily automatic invoice reminders via pg_cron.
-- The Edge Function send-auto-reminders is invoked with the secret configured
-- in Supabase Vault under the name AUTO_REMINDER_SECRET.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: invoke the send-auto-reminders Edge Function using the vault secret.
CREATE OR REPLACE FUNCTION public.invoke_send_auto_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  -- Read the shared secret from Supabase Vault.
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'AUTO_REMINDER_SECRET'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'AUTO_REMINDER_SECRET is not configured in vault.decrypted_secrets';
  END IF;

  -- Edge Function URL (stable project ref).
  v_url := 'https://ngdvmodloxuvrdjjzxel.supabase.co/functions/v1/send-auto-reminders';

  -- Use pg_net to POST asynchronously to the Edge Function.
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  RAISE NOTICE 'send-auto-reminders invoked';
END;
$$;

GRANT EXECUTE ON FUNCTION public.invoke_send_auto_reminders() TO postgres;

-- Schedule daily run at 08:30 UTC.
SELECT cron.schedule(
  'daily-invoice-reminders',
  '30 8 * * *',
  'SELECT public.invoke_send_auto_reminders();'
);

-- Idempotent: cron.schedule overwrites jobs with the same name.
