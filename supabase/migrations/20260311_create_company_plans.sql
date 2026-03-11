create extension if not exists pgcrypto;

create table if not exists public.company_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_key text not null,
  name text not null,
  description text,
  price_amount integer not null check (price_amount >= 0),
  currency text not null default 'CLP',
  billing_interval text not null check (billing_interval in ('day', 'week', 'month', 'year')),
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_plans_company_plan_key_unique unique (company_id, plan_key)
);

create index if not exists company_plans_company_active_order_idx
  on public.company_plans (company_id, is_active, sort_order);

create unique index if not exists company_plans_stripe_price_id_unique_idx
  on public.company_plans (stripe_price_id)
  where stripe_price_id is not null;

create or replace function public.set_company_plans_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_company_plans_updated_at on public.company_plans;

create trigger trg_company_plans_updated_at
before update on public.company_plans
for each row execute procedure public.set_company_plans_updated_at();

insert into public.company_plans (
  company_id,
  plan_key,
  name,
  description,
  price_amount,
  currency,
  billing_interval,
  sort_order,
  is_featured,
  is_active,
  stripe_price_id
)
select
  c.id,
  v.plan_key,
  v.name,
  v.description,
  v.price_amount,
  v.currency,
  v.billing_interval,
  v.sort_order,
  v.is_featured,
  v.is_active,
  v.stripe_price_id
from public.companies c
cross join (
  values
    ('esencial', 'Esencial', '2 clases por semana', 24900, 'CLP', 'month', 1, false, true, null),
    ('equilibrio', 'Equilibrio', '3 clases por semana', 31900, 'CLP', 'month', 2, true, true, null),
    ('libre', 'Libre', 'Clases ilimitadas', 39900, 'CLP', 'month', 3, false, true, null)
) as v(
  plan_key,
  name,
  description,
  price_amount,
  currency,
  billing_interval,
  sort_order,
  is_featured,
  is_active,
  stripe_price_id
)
where c.slug = 'yoga-estudio'
on conflict (company_id, plan_key)
do update set
  name = excluded.name,
  description = excluded.description,
  price_amount = excluded.price_amount,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  stripe_price_id = excluded.stripe_price_id,
  updated_at = now();
