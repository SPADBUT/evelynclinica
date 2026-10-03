-- Fase A1 (canônico): extensions + helper updated_at
-- Schema legado clinics/profiles: supabase/legacy/a1_clinics_superseded/

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at on row updates (A1 foundation).';
