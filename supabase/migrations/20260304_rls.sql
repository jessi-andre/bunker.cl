-- Migration: Row Level Security (RLS) — defense in depth
-- All data access goes through the service_role key (bypasses RLS),
-- but enabling RLS ensures that anon/authenticated Supabase keys cannot
-- read any sensitive data directly.

-- admin_sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_sessions_deny_all ON public.admin_sessions;
CREATE POLICY admin_sessions_deny_all ON public.admin_sessions
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- company_admins
ALTER TABLE public.company_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_admins_deny_all ON public.company_admins;
CREATE POLICY company_admins_deny_all ON public.company_admins
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_deny_all ON public.companies;
CREATE POLICY companies_deny_all ON public.companies
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS login_attempts_deny_all ON public.login_attempts;
CREATE POLICY login_attempts_deny_all ON public.login_attempts
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_deny_all ON public.audit_logs;
CREATE POLICY audit_logs_deny_all ON public.audit_logs
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- company_subscriptions
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_subscriptions_deny_all ON public.company_subscriptions;
CREATE POLICY company_subscriptions_deny_all ON public.company_subscriptions
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);

-- stripe_events
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stripe_events_deny_all ON public.stripe_events;
CREATE POLICY stripe_events_deny_all ON public.stripe_events
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);
