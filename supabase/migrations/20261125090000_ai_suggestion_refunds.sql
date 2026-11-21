-- =============================================================================
-- Surinder Caterers – Phase 6: refund a suggestion slot when the AI provider fails
--
-- * claim_ai_suggestion() now returns the claim's id. Refunded claims no longer
--   count towards the daily limit, but still count towards the per-minute limit,
--   so a failing provider can't be hammered.
-- * refund_ai_suggestion(claim, user, reason) gives back exactly that one claim.
--   It is callable ONLY by the server (service_role, i.e. the Supabase secret key)
--   – never by customers, who could otherwise refund their successful requests.
--   A claim can be refunded at most once (the UPDATE ... WHERE refunded_at IS NULL
--   is atomic under concurrent calls), only by the user who made it, and only
--   within 15 minutes of being made.
-- Safe to re-run.
-- =============================================================================

alter table public.ai_suggestion_log
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_reason text;

-- Both columns are set together, a refund never predates its claim, and the reason is known.
-- (Explicit IS NOT NULL checks: a CHECK that evaluates to NULL would otherwise pass.)
alter table public.ai_suggestion_log drop constraint if exists ai_suggestion_log_refund_check;
alter table public.ai_suggestion_log add constraint ai_suggestion_log_refund_check check (
  (refunded_at is null and refund_reason is null)
  or (refunded_at is not null and refund_reason is not null
      and refunded_at >= created_at
      and refund_reason in ('provider_error', 'provider_timeout', 'provider_rate_limited',
                            'provider_overloaded', 'invalid_provider_output')));

create or replace function public.claim_ai_suggestion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid          uuid := auth.uid();
  daily_limit  constant integer := 20;
  used_today   integer;
  v_claim_id   bigint;
begin
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'Please sign in to get menu suggestions.' using errcode = '42501';
  end if;

  -- Serialise claims and refunds per user so parallel requests can't overshoot the limit.
  perform pg_advisory_xact_lock(hashtextextended('ai_suggestion:' || uid::text, 0));

  -- Per-minute limit counts every attempt, refunded or not.
  if (select count(*) from public.ai_suggestion_log l
       where l.user_id = uid and l.created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Please wait a minute before asking for more suggestions.' using errcode = '22023';
  end if;

  select count(*) into used_today from public.ai_suggestion_log l
   where l.user_id = uid and l.created_at > now() - interval '24 hours' and l.refunded_at is null;
  if used_today >= daily_limit then
    raise exception 'You have used today''s menu suggestions. Please try again tomorrow or pick dishes yourself.'
      using errcode = '22023';
  end if;

  insert into public.ai_suggestion_log (user_id) values (uid) returning id into v_claim_id;
  delete from public.ai_suggestion_log l where l.user_id = uid and l.created_at < now() - interval '7 days';

  return jsonb_build_object('claim_id', v_claim_id, 'remaining', daily_limit - used_today - 1);
end;
$$;

revoke execute on function public.claim_ai_suggestion() from public, anon;
grant execute on function public.claim_ai_suggestion() to authenticated;

create or replace function public.refund_ai_suggestion(p_claim_id bigint, p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit constant integer := 20;
  v_id        bigint;
  used_today  integer;
begin
  if p_claim_id is null or p_user_id is null then
    raise exception 'claim and user are required' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('provider_error', 'provider_timeout', 'provider_rate_limited',
                                          'provider_overloaded', 'invalid_provider_output') then
    raise exception 'invalid refund reason' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_suggestion:' || p_user_id::text, 0));

  -- Atomic: of several concurrent refunds for one claim, exactly one matches.
  update public.ai_suggestion_log l
     set refunded_at = now(), refund_reason = p_reason
   where l.id = p_claim_id
     and l.user_id = p_user_id
     and l.refunded_at is null
     and l.created_at > now() - interval '15 minutes'
  returning l.id into v_id;

  select count(*) into used_today from public.ai_suggestion_log l
   where l.user_id = p_user_id and l.created_at > now() - interval '24 hours' and l.refunded_at is null;

  return jsonb_build_object('refunded', v_id is not null, 'remaining', greatest(daily_limit - used_today, 0));
end;
$$;

revoke execute on function public.refund_ai_suggestion(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_suggestion(bigint, uuid, text) to service_role;
