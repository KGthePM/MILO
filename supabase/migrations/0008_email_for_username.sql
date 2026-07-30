-- Username login support.
-- Supabase Auth only authenticates by email, so to let users sign in with
-- their username we resolve username -> email server-side, then the client
-- calls signInWithPassword with the resolved email.
--
-- Mirrors the find_user_by_email pattern in 0002_friends.sql. Callable by
-- anon because the caller is signed out during login.
create or replace function email_for_username(p_username text)
returns text language sql security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username::citext   -- cast so comparison is case-insensitive
  limit 1;
$$;

revoke all on function email_for_username(text) from public;
grant execute on function email_for_username(text) to anon, authenticated;
