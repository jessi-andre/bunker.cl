create table if not exists public.alumnos (
  id bigserial primary key,
  email text unique not null,
  stripeCustomerId text,
  stripeSubscriptionId text,
  status text default 'pending',
  plan text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_alumnos_updated_at on public.alumnos;
create trigger trg_alumnos_updated_at
before update on public.alumnos
for each row execute procedure public.set_updated_at();