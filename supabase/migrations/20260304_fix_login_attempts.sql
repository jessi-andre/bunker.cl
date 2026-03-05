-- Migration: Fix login_attempts table schema
-- The previous schema (key TEXT PRIMARY KEY) is incompatible with the actual
-- usage in login.js which queries by company_id + ip.
-- This migration drops and recreates the table with the correct schema.

DROP TABLE IF EXISTS public.login_attempts;

CREATE TABLE public.login_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL,
  ip         text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the rate-limit query: SELECT count(*) WHERE company_id=? AND ip=? AND updated_at > ?
CREATE INDEX login_attempts_company_ip_updated_idx
  ON public.login_attempts (company_id, ip, updated_at DESC);

-- Index for the cleanup of old rows
CREATE INDEX login_attempts_updated_at_idx
  ON public.login_attempts (updated_at);
