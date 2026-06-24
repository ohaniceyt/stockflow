-- Enable row-level security on rate-limit audit tables.
-- These tables are only written/read by Edge Functions using the service-role key,
-- so no user-facing policies are required. Enabling RLS blocks direct client access
-- via PostgREST and satisfies the database linter.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_link_requests ENABLE ROW LEVEL SECURITY;
