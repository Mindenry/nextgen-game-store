-- ============================================================================
-- SUPABASE ONLY — keep the application profile row in sync with Supabase Auth
-- Apply this migration in the Supabase SQL editor / CLI. It is skipped by the
-- embedded local driver.
-- ============================================================================
create or replace function public.handle_new_supabase_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, email_verified_at)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@oauth.local'),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'player'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email_confirmed_at
  )
  on conflict (id) do update
    set email = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
        email_verified_at = coalesce(excluded.email_verified_at, profiles.email_verified_at);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data, email_confirmed_at on auth.users
  for each row execute function public.handle_new_supabase_user();
