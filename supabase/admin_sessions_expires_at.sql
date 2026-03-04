alter table if exists public.admin_sessions
  add column if not exists expires_at timestamptz;

update public.admin_sessions
set expires_at = coalesce(expires_at, now() + interval '7 days')
where expires_at is null;

alter table public.admin_sessions
  alter column expires_at set not null;

alter table public.admin_sessions
  alter column expires_at set default (now() + interval '7 days');
