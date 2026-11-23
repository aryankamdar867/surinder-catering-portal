-- =============================================================================
-- Surinder Caterers – Phase 9: let the server remove test data
--
-- Sent quotation versions are a record of what the customer was shown, so they
-- can never be deleted from the app. Until now that rule applied to every role,
-- including the server-only service role, so test enquiries with a sent
-- quotation (Phase 7 live checks, Phase 9 end-to-end runs) could never be
-- cleaned up before launch.
--
-- After this migration a sent version can be deleted only when the request is
-- server-side:
--   * the API request was made with the secret key (JWT role 'service_role',
--     used by `npm run test:e2e:cleanup`), or
--   * there is no API request at all (Supabase SQL editor, migrations).
-- Every app user – anon, customers AND the owner – is still refused, including
-- when the delete happens inside a SECURITY DEFINER function. Such functions run
-- as their owner (postgres), so `current_user` alone can't be trusted there; the
-- caller's JWT role is what PostgREST sets for the whole request, so it is
-- checked as well. The `current_user` check stays as a second layer (it catches
-- `set role authenticated` in the SQL editor, where there is no JWT).
--
-- The secret key never reaches the browser (src/lib/supabase.js refuses it).
-- Safe to re-run.
-- =============================================================================

create or replace function public.quotation_versions_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- PostgREST sets request.jwt.claims for every API request; it is unset (NULL)
  -- or empty outside one. Anything that isn't a JSON object counts as no JWT.
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role   text := 'none';
begin
  if old.status = 'draft' then
    return old;
  end if;

  if v_claims is not null then
    begin
      v_role := coalesce(v_claims::jsonb ->> 'role', '');
    exception when others then
      v_role := '';  -- unreadable claims: treat as an untrusted caller
    end;
  end if;

  if current_user in ('anon', 'authenticated') or v_role not in ('service_role', 'none') then
    raise exception 'Sent quotation versions cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke execute on function public.quotation_versions_before_delete() from public, anon, authenticated;
