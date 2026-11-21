-- =============================================================================
-- Surinder Caterers – Phase 6: AI menu suggestions
--
-- * ai_suggestion_log + claim_ai_suggestion(): a per-customer rate limit for the
--   /api/menu-suggestions function. The function calls claim_ai_suggestion() with
--   the customer's own session BEFORE calling the AI provider, so no server
--   secret key is needed and the limit can't be skipped from the browser.
-- * submit_enquiry(): unchanged from Phase 5 except that each dish may carry
--   "source": "ai" (anything else is stored as 'customer'). Prices are still
--   snapshotted from public.dishes; the AI never supplies names or prices.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.ai_suggestion_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists ai_suggestion_log_user_idx on public.ai_suggestion_log (user_id, created_at desc);

-- RLS on with no policies: nobody reads or writes this table through the API.
alter table public.ai_suggestion_log enable row level security;
revoke all on public.ai_suggestion_log from anon, authenticated;

-- Limits: 3 per minute (stops double-clicks / loops) and 20 per 24 hours.
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
begin
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'Please sign in to get menu suggestions.' using errcode = '42501';
  end if;

  -- Serialise claims per user so parallel requests can't overshoot the limit.
  perform pg_advisory_xact_lock(hashtextextended('ai_suggestion:' || uid::text, 0));

  if (select count(*) from public.ai_suggestion_log l
       where l.user_id = uid and l.created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Please wait a minute before asking for more suggestions.' using errcode = '22023';
  end if;

  select count(*) into used_today from public.ai_suggestion_log l
   where l.user_id = uid and l.created_at > now() - interval '24 hours';
  if used_today >= daily_limit then
    raise exception 'You have used today''s menu suggestions. Please try again tomorrow or pick dishes yourself.'
      using errcode = '22023';
  end if;

  insert into public.ai_suggestion_log (user_id) values (uid);
  delete from public.ai_suggestion_log l where l.user_id = uid and l.created_at < now() - interval '7 days';

  return jsonb_build_object('remaining', daily_limit - used_today - 1);
end;
$$;

revoke execute on function public.claim_ai_suggestion() from public, anon;
grant execute on function public.claim_ai_suggestion() to authenticated;

create or replace function public.submit_enquiry(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  ev         jsonb := coalesce(payload -> 'event', '{}'::jsonb);
  ct         jsonb := coalesce(payload -> 'contact', '{}'::jsonb);
  picks      jsonb := coalesce(payload -> 'dishes', '[]'::jsonb);
  today      date := (now() at time zone 'Asia/Kolkata')::date;

  v_event_type    text := ev ->> 'event_type';
  v_event_other   text := nullif(btrim(coalesce(ev ->> 'event_type_other', '')), '');
  v_event_date    date;
  v_event_time    time;
  v_venue_name    text := nullif(btrim(coalesce(ev ->> 'venue_name', '')), '');
  v_venue_address text := nullif(btrim(coalesce(ev ->> 'venue_address', '')), '');
  v_guests        integer;
  v_service       text := ev ->> 'service_type';
  v_cuisines      text[] := '{}';
  v_dietary       text := nullif(btrim(coalesce(ev ->> 'dietary_requirements', '')), '');
  v_special       text := nullif(btrim(coalesce(ev ->> 'special_instructions', '')), '');

  v_name     text := nullif(btrim(coalesce(ct ->> 'contact_name', '')), '');
  v_phone    text := nullif(btrim(coalesce(ct ->> 'contact_phone', '')), '');
  v_email    text := nullif(lower(btrim(coalesce(ct ->> 'contact_email', ''))), '');
  v_address  text := nullif(btrim(coalesce(ct ->> 'address', '')), '');
  v_company  text := nullif(btrim(coalesce(ct ->> 'company_name', '')), '');
  v_gst      text := nullif(upper(btrim(coalesce(ct ->> 'gst_number', ''))), '');
  v_total_budget numeric;
  v_pp_budget    numeric;
  v_flex     text := coalesce(nullif(ct ->> 'budget_flexibility', ''), 'flexible');

  v_id       uuid;
  v_number   text;
  item       jsonb;
  v_dish_id  uuid;
  v_qty      numeric;
  v_source   text;
  d          record;
begin
  -- Caller -------------------------------------------------------------------
  if uid is null or not exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'Please sign in to send an enquiry.' using errcode = '42501';
  end if;

  if (select count(*) from public.enquiries e
       where e.customer_id = uid and e.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have sent several enquiries today. Please call us or try again tomorrow.'
      using errcode = '22023';
  end if;

  -- Event --------------------------------------------------------------------
  if v_event_type is null or v_event_type not in ('wedding', 'reception', 'engagement', 'sangeet', 'mehendi',
       'birthday', 'anniversary', 'corporate', 'religious', 'housewarming', 'festival', 'other') then
    raise exception 'Choose the type of event.' using errcode = '22023';
  end if;
  if v_event_type = 'other' and v_event_other is null then
    raise exception 'Describe the type of event.' using errcode = '22023';
  end if;
  if v_event_type <> 'other' then v_event_other := null; end if;
  if char_length(v_event_other) > 80 then
    raise exception 'Keep the event description under 80 characters.' using errcode = '22023';
  end if;

  begin
    v_event_date := (ev ->> 'event_date')::date;
  exception when others then
    raise exception 'Enter a valid event date.' using errcode = '22023';
  end;
  if v_event_date is null or v_event_date <= today then
    raise exception 'The event date must be from tomorrow onwards.' using errcode = '22023';
  end if;
  if v_event_date > today + interval '2 years' then
    raise exception 'We take bookings up to two years ahead.' using errcode = '22023';
  end if;

  begin
    v_event_time := nullif(ev ->> 'event_time', '')::time;
  exception when others then
    raise exception 'Enter a valid event time.' using errcode = '22023';
  end;

  if v_venue_name is null then
    raise exception 'Enter the venue name.' using errcode = '22023';
  end if;
  if char_length(v_venue_name) > 200 or char_length(v_venue_address) > 500 then
    raise exception 'The venue details are too long.' using errcode = '22023';
  end if;

  begin
    v_guests := (ev ->> 'guest_count')::integer;
  exception when others then
    raise exception 'Enter the number of guests as a whole number.' using errcode = '22023';
  end;
  if v_guests is null or v_guests < 1 or v_guests > 100000 then
    raise exception 'Guest count must be between 1 and 100,000.' using errcode = '22023';
  end if;

  if v_service is null or v_service not in ('buffet', 'plated', 'live_counters', 'family_style',
       'packed_meals', 'mixed') then
    raise exception 'Choose a service style.' using errcode = '22023';
  end if;

  if jsonb_typeof(ev -> 'cuisine_preferences') = 'array' then
    select coalesce(array_agg(distinct btrim(x)), '{}') into v_cuisines
      from jsonb_array_elements_text(ev -> 'cuisine_preferences') as x
     where btrim(x) <> '';
  end if;
  if cardinality(v_cuisines) > 20
     or exists (select 1 from unnest(v_cuisines) c where char_length(c) > 80) then
    raise exception 'Too many cuisine preferences.' using errcode = '22023';
  end if;
  if char_length(v_dietary) > 1000 or char_length(v_special) > 2000 then
    raise exception 'The notes are too long.' using errcode = '22023';
  end if;

  -- Contact and budget -------------------------------------------------------
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Enter a contact name (2–120 characters).' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a valid contact phone number.' using errcode = '22023';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid contact email.' using errcode = '22023';
  end if;
  if char_length(v_address) > 500 or char_length(v_company) > 150 then
    raise exception 'The address or company name is too long.' using errcode = '22023';
  end if;
  if v_gst is not null and v_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Enter a valid 15-character GSTIN, or leave it blank.' using errcode = '22023';
  end if;

  begin
    v_total_budget := nullif(ct ->> 'total_budget', '')::numeric;
    v_pp_budget    := nullif(ct ->> 'per_person_budget', '')::numeric;
  exception when others then
    raise exception 'Enter budgets as numbers.' using errcode = '22023';
  end;
  if v_total_budget < 0 or v_total_budget >= 1e10 or v_pp_budget < 0 or v_pp_budget >= 1e8 then
    raise exception 'Enter a realistic budget.' using errcode = '22023';
  end if;
  if v_flex not in ('strict', 'flexible', 'premium') then
    raise exception 'Choose how flexible your budget is.' using errcode = '22023';
  end if;

  -- Dishes (shape only; availability is checked per dish below) --------------
  if jsonb_typeof(picks) <> 'array' then
    raise exception 'Invalid dish selection.' using errcode = '22023';
  end if;
  if jsonb_array_length(picks) > 100 then
    raise exception 'Choose at most 100 dishes.' using errcode = '22023';
  end if;

  -- Write --------------------------------------------------------------------
  insert into public.enquiries (customer_id, contact_name, contact_phone, contact_email, address,
                                company_name, gst_number, total_budget, per_person_budget, budget_flexibility)
  values (uid, v_name, v_phone, v_email, v_address, v_company, v_gst,
          round(v_total_budget, 2), round(v_pp_budget, 2), v_flex)
  returning id, enquiry_number into v_id, v_number;

  insert into public.event_details (enquiry_id, event_type, event_type_other, event_date, event_time, venue_name,
                                    venue_address, guest_count, service_type, cuisine_preferences,
                                    dietary_requirements, special_instructions)
  values (v_id, v_event_type, v_event_other, v_event_date, v_event_time, v_venue_name, v_venue_address,
          v_guests, v_service, v_cuisines, v_dietary, v_special);

  for item in select value from jsonb_array_elements(picks) loop
    begin
      v_dish_id := (item ->> 'dish_id')::uuid;
      v_qty := round((item ->> 'quantity')::numeric, 2);
      v_source := case when item ->> 'source' = 'ai' then 'ai' else 'customer' end;
    exception when others then
      raise exception 'Invalid dish selection.' using errcode = '22023';
    end;
    if v_dish_id is null or v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'Each dish needs a quantity between 0.01 and 100,000.' using errcode = '22023';
    end if;

    select dsh.name, dsh.is_available, cat.is_active as category_active, cui.is_active as cuisine_active
      into d
      from public.dishes dsh
      join public.categories cat on cat.id = dsh.category_id
      join public.cuisines cui on cui.id = dsh.cuisine_id
     where dsh.id = v_dish_id;
    if not found or not d.category_active or not d.cuisine_active then
      raise exception 'One of the selected dishes is no longer on our menu. Please review your selection.'
        using errcode = '22023';
    end if;
    if not d.is_available then
      raise exception '"%" is currently unavailable. Please remove it and try again.', d.name
        using errcode = '22023';
    end if;
    if exists (select 1 from public.menu_selections m where m.enquiry_id = v_id and m.dish_id = v_dish_id) then
      raise exception '"%" was selected twice.', d.name using errcode = '22023';
    end if;

    -- Name, price, unit, labels and tier are filled in by the snapshot trigger.
    insert into public.menu_selections (enquiry_id, dish_id, quantity, source)
    values (v_id, v_dish_id, v_qty, v_source);
  end loop;

  -- Notifications (shown in Phase 8) -----------------------------------------
  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id)
  select p.id, 'enquiry_submitted', 'New enquiry ' || v_number,
         v_name || ' · ' || v_guests || ' guests · ' || to_char(v_event_date, 'DD Mon YYYY'),
         '/admin/enquiries/' || v_id, v_id
    from public.profiles p
   where p.role = 'admin';

  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id)
  values (uid, 'enquiry_submitted', 'We received your enquiry ' || v_number,
          'Our team will review it and get back to you with a quotation.',
          '/account/enquiries/' || v_id, v_id);

  return jsonb_build_object('id', v_id, 'enquiry_number', v_number);
end;
$$;

revoke execute on function public.submit_enquiry(jsonb) from public, anon;
grant execute on function public.submit_enquiry(jsonb) to authenticated;
