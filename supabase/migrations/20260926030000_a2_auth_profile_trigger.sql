-- A2: auto-create staff profile when a Supabase Auth user is created.
-- Patients do NOT get auth.users / profiles (Secure Links = A5).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do update
    set
      email = excluded.email,
      full_name = coalesce(
        nullif(trim(excluded.full_name), ''),
        public.profiles.full_name
      ),
      updated_at = timezone('utc', now());

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'A2: SECURITY DEFINER trigger — creates/updates public.profiles from auth.users. search_path fixed to public.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
