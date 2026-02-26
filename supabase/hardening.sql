-- FASE 2/3/4/6/7/8 hardening para Bunker
create extension if not exists pgcrypto;

-- admin_sessions: columnas para seguridad avanzada
alter table if exists public.admin_sessions
  add column if not exists company_id uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz,
  add column if not exists user_agent_hash text;

-- backfill de company_id desde company_admins si falta
update public.admin_sessions s
set company_id = a.company_id
from public.company_admins a
where s.admin_id = a.id
  and s.company_id is null;

create index if not exists admin_sessions_token_hash_idx on public.admin_sessions (token_hash);
create index if not exists admin_sessions_company_id_idx on public.admin_sessions (company_id);
create index if not exists admin_sessions_expires_at_idx on public.admin_sessions (expires_at);

-- revocación global
alter table if exists public.company_admins
  add column if not exists sessions_revoked_at timestamptz;

alter table if exists public.companies
  add column if not exists sessions_revoked_at timestamptz;

-- rate limiting login
create table if not exists public.login_attempts (
  key text primary key,
  attempts integer not null default 0,
  first_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_attempts_locked_until_idx on public.login_attempts (locked_until);

-- stripe subscriptions por company
create table if not exists public.company_subscriptions (
  company_id uuid primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  plan text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- logs de auditoría
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  route text,
  company_id uuid,
  admin_id uuid,
  action text,
  result text,
  error_code text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_company_id_idx on public.audit_logs (company_id);
create index if not exists audit_logs_admin_id_idx on public.audit_logs (admin_id);
