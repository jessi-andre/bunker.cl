alter table if exists public.companies
  add column if not exists slug text,
  add column if not exists business_type text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;

create unique index if not exists companies_slug_unique_idx
  on public.companies (slug)
  where slug is not null;

insert into public.companies (
  name,
  slug,
  business_type,
  whatsapp,
  email,
  is_active
) values (
  'Yoga Estudio',
  'yoga-estudio',
  'yoga',
  '+56911111111',
  'hola@yogaestudio.cl',
  true
);
