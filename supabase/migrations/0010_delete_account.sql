-- 0010: Self-service account deletion (Apple App Store Guideline 5.1.1(v)).
--
-- Apps that offer account creation must also offer in-app account deletion.
-- supabase-js has no client-side "delete my own user" call (that lives in the
-- admin API, which needs the service-role key we must never ship), so we
-- expose a security-definer RPC restricted to the caller's own auth.uid().
--
-- Deleting the auth.users row cascades through every MILO table:
-- movies, taste_profiles, rec_feedback, profiles, friends — all reference
-- auth.users(id) on delete cascade.

create or replace function public.delete_my_account(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Explicit confirmation phrase from the client, so a stray call can't nuke an account.
  if p_confirm is distinct from 'DELETE' then
    return jsonb_build_object('ok', false, 'error', 'Confirmation phrase required.');
  end if;

  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  end if;

  -- auth.sessions / auth.identities / auth.mfa_factors cascade on user delete,
  -- and every public.* table cascades via FK (see migrations 0001-0009).
  delete from auth.users where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

-- Only signed-in users may call it; anon and the public role cannot.
revoke all on function public.delete_my_account(text) from anon, public;
grant execute on function public.delete_my_account(text) to authenticated;
