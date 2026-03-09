alter table if exists public.alumnos
  add column if not exists company_id uuid,
  add column if not exists full_name text,
  add column if not exists goal text,
  add column if not exists availability text,
  add column if not exists experience text,
  add column if not exists injuries text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

create unique index if not exists alumnos_company_email_unique_idx
  on public.alumnos (company_id, email);
