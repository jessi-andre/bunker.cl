alter table if exists public.alumnos
  add column if not exists whatsapp_clicked_at timestamptz;
