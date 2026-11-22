-- =============================================================================
-- Surinder Caterers – Phase 7: admin enquiry management and quotations
--
-- * Enquiry status changes go through set_enquiry_status() (admins) or the
--   quotation functions below; a trigger blocks direct status updates by API users.
-- * All writes to quotations, quotation_versions and quotation_items go through
--   SECURITY DEFINER functions. API users (even admins) have no direct write rights,
--   so a quotation can't be marked sent/accepted without the checks below.
-- * Lifecycle:
--     create_quotation       enquiry → quotation + draft version 1 (prefilled from the enquiry menu)
--     save_quotation_draft   replace the draft's settings and items in one transaction
--     send_quotation         draft → sent (previous sent version → superseded); enquiry → quoted
--     create_quotation_revision  copy the latest version into a new draft
--     withdraw_quotation     sent → withdrawn; enquiry → under review
--     discard_quotation_draft    delete the draft (and the quotation if it was never sent)
--     respond_to_quotation   customer accepts (enquiry → confirmed) or declines (→ under review)
-- * Item prices may be empty while drafting; itemised quotations need every price
--   before they are sent. Totals are still computed only by the database.
-- * Friendly validation errors use errcode 22023 (shown to users as-is).
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Privileges and schema tweaks
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.quotations, public.quotation_versions, public.quotation_items
  from authenticated;

alter table public.quotation_items alter column unit_price drop not null;

-- Same as the core schema version, plus: itemised quotations need every price before sending.
create or replace function public.quotation_versions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  gross numeric(12, 2);
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    -- A sent version may only be marked superseded; nothing else can change.
    if old.status = 'sent' and new.status = 'superseded'
       and (to_jsonb(new) - array['status', 'updated_at']) = (to_jsonb(old) - array['status', 'updated_at']) then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Quotation version % is locked. Create a revision instead.', old.version_number
      using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.additional_charges) e
     where jsonb_typeof(e) <> 'object'
        or jsonb_typeof(e -> 'amount') <> 'number'
        or (e ->> 'amount')::numeric < 0
        or char_length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 120
  ) then
    raise exception 'Each additional charge needs a label and a non-negative amount' using errcode = '23514';
  end if;

  select coalesce(sum(line_total), 0) into new.items_total
    from public.quotation_items where version_id = new.id;

  new.subtotal := case new.pricing_mode
                    when 'per_person' then round(new.guest_count * new.per_person_rate, 2)
                    else new.items_total
                  end;

  select coalesce(sum((e ->> 'amount')::numeric), 0) into new.additional_charges_total
    from jsonb_array_elements(new.additional_charges) e;

  gross := new.subtotal + new.additional_charges_total;

  new.discount_amount := case new.discount_type
                           when 'amount' then new.discount_value
                           when 'percent' then round(gross * new.discount_value / 100, 2)
                           else 0
                         end;
  new.taxable_amount := gross - new.discount_amount;
  new.gst_amount     := round(new.taxable_amount * new.gst_rate / 100, 2);
  new.total_amount   := new.taxable_amount + new.gst_amount;
  new.balance_amount := new.total_amount - new.advance_amount;

  if new.status = 'sent' then
    if not exists (select 1 from public.quotation_items where version_id = new.id) then
      raise exception 'Add at least one menu item before sending the quotation' using errcode = '23514';
    end if;
    if new.pricing_mode = 'itemised'
       and exists (select 1 from public.quotation_items where version_id = new.id and unit_price is null) then
      raise exception 'Set a price for every item before sending, or use per-person pricing' using errcode = '23514';
    end if;
    if new.discount_amount > gross then
      raise exception 'Discount cannot exceed the subtotal plus charges' using errcode = '23514';
    end if;
    if new.advance_amount > new.total_amount then
      raise exception 'Advance payment cannot exceed the total amount' using errcode = '23514';
    end if;
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Enquiry status may only change inside the SECURITY DEFINER functions
-- (which run as the function owner, not as 'authenticated').
create or replace function public.enquiries_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.status is distinct from old.status then
    raise exception 'Enquiry status can only be changed through set_enquiry_status()' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enquiries_guard_status on public.enquiries;
create trigger enquiries_guard_status
  before update of status on public.enquiries
  for each row execute function public.enquiries_guard_status();

-- -----------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- -----------------------------------------------------------------------------

-- Parse an optional non-negative amount from JSON text. NULL/blank → NULL.
create or replace function public.parse_quote_amount(p_value text, p_label text, p_max numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  n numeric;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  begin
    n := btrim(p_value)::numeric;
  exception when others then
    raise exception '% must be a number.', p_label using errcode = '22023';
  end;
  -- NaN and Infinity compare greater than every number, so they fail here too.
  if n < 0 or n >= p_max then
    raise exception 'Enter a realistic value for %.', lower(p_label) using errcode = '22023';
  end if;
  return round(n, 2);
end;
$$;

create or replace function public.notify_customer_of_status(p_enquiry_id uuid, p_status text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_number   text;
begin
  select e.customer_id, e.enquiry_number into v_customer, v_number
    from public.enquiries e where e.id = p_enquiry_id;

  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id)
  values (
    v_customer,
    'enquiry_status_changed',
    case p_status
      when 'under_review' then 'We are reviewing your enquiry ' || v_number
      when 'confirmed'    then 'Your event is confirmed'
      when 'completed'    then 'Thank you for choosing Surinder Caterers'
      when 'cancelled'    then 'Enquiry ' || v_number || ' was cancelled'
      else 'Update on your enquiry ' || v_number
    end,
    coalesce(p_message, case p_status
      when 'under_review' then 'Our team is preparing options for your event.'
      when 'confirmed'    then 'Thank you for accepting our quotation. We look forward to serving you.'
      when 'completed'    then 'We hope you and your guests enjoyed the food.'
      when 'cancelled'    then 'This enquiry has been cancelled. Please contact us if this is unexpected.'
      when 'declined'     then 'We are unable to cater this event. Please contact us for details.'
    end),
    '/account/enquiries/' || p_enquiry_id,
    p_enquiry_id
  );
end;
$$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_enquiry_id uuid, p_quotation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id, quotation_id)
  select p.id, p_type, p_title, p_body, '/admin/enquiries/' || p_enquiry_id, p_enquiry_id, p_quotation_id
    from public.profiles p
   where p.role = 'admin';
$$;

-- -----------------------------------------------------------------------------
-- Admin: enquiry status
--   submitted    → under review, declined, cancelled
--   under review → declined, cancelled
--   quoted       → declined, cancelled (a sent quotation is withdrawn)
--   confirmed    → completed (on/after the event date), cancelled
-- "quoted" and "confirmed" are reached only through the quotation functions.
-- -----------------------------------------------------------------------------

create or replace function public.set_enquiry_status(p_enquiry_id uuid, p_status text, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status     text;
  v_event_date date;
  v_message    text := nullif(btrim(coalesce(p_message, '')), '');
  today        date := (now() at time zone 'Asia/Kolkata')::date;
  allowed      text[];
begin
  if not public.is_admin() then
    raise exception 'Only the owner can change an enquiry''s status.' using errcode = '42501';
  end if;

  select e.status into v_status from public.enquiries e where e.id = p_enquiry_id for update;
  if not found then
    raise exception 'Enquiry not found.' using errcode = 'P0002';
  end if;
  if v_status = p_status then
    return;
  end if;

  allowed := case v_status
               when 'submitted'    then array['under_review', 'declined', 'cancelled']
               when 'under_review' then array['declined', 'cancelled']
               when 'quoted'       then array['declined', 'cancelled']
               when 'confirmed'    then array['completed', 'cancelled']
               else array[]::text[]
             end;
  if p_status is null or not (p_status = any (allowed)) then
    raise exception 'This enquiry can''t be moved from "%" to "%".',
      replace(v_status, '_', ' '), replace(coalesce(p_status, '?'), '_', ' ')
      using errcode = '22023';
  end if;

  select ed.event_date into v_event_date from public.event_details ed where ed.enquiry_id = p_enquiry_id;
  if p_status = 'completed' and v_event_date > today then
    raise exception 'An event can only be marked completed on or after its date.' using errcode = '22023';
  end if;
  if char_length(v_message) > 1000 then
    raise exception 'Keep the message to the customer under 1,000 characters.' using errcode = '22023';
  end if;

  update public.enquiries set status = p_status where id = p_enquiry_id;

  if p_status in ('declined', 'cancelled') then
    update public.quotations set status = 'withdrawn' where enquiry_id = p_enquiry_id and status = 'sent';
  end if;

  perform public.notify_customer_of_status(p_enquiry_id, p_status, v_message);
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: quotations
-- -----------------------------------------------------------------------------

-- One quotation per enquiry; calling again returns the existing one.
create or replace function public.create_quotation(p_enquiry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   text;
  v_customer uuid;
  v_guests   integer;
  v_quote    uuid;
  v_version  uuid;
  today      date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can prepare quotations.' using errcode = '42501';
  end if;

  select e.status, e.customer_id into v_status, v_customer
    from public.enquiries e where e.id = p_enquiry_id for update;
  if not found then
    raise exception 'Enquiry not found.' using errcode = 'P0002';
  end if;

  select q.id into v_quote from public.quotations q
   where q.enquiry_id = p_enquiry_id order by q.created_at limit 1;
  if found then
    return v_quote;
  end if;

  if v_status not in ('submitted', 'under_review') then
    raise exception 'Quotations can only be prepared for open enquiries.' using errcode = '22023';
  end if;

  select ed.guest_count into v_guests from public.event_details ed where ed.enquiry_id = p_enquiry_id;

  insert into public.quotations (enquiry_id, customer_id)
  values (p_enquiry_id, v_customer)
  returning id into v_quote;

  insert into public.quotation_versions (quotation_id, version_number, guest_count, valid_until)
  values (v_quote, 1, coalesce(v_guests, 1), today + 14)
  returning id into v_version;

  -- Start from the customer's requested menu (their snapshot price, else today's price).
  -- A whole enquiry's dishes share one created_at, so order them by category and name
  -- to keep the starting order stable.
  insert into public.quotation_items (version_id, dish_id, dish_name, category_name, cuisine_name,
                                      unit_price, pricing_unit, quantity, sort_order)
  select v_version, m.dish_id, m.dish_name, m.category_name, m.cuisine_name,
         coalesce(m.unit_price, d.price), m.pricing_unit, m.quantity,
         (row_number() over (order by m.created_at, m.category_name, m.dish_name, m.id))::integer
    from public.menu_selections m
    left join public.dishes d on d.id = m.dish_id
   where m.enquiry_id = p_enquiry_id;

  if v_status = 'submitted' then
    update public.enquiries set status = 'under_review' where id = p_enquiry_id;
    perform public.notify_customer_of_status(p_enquiry_id, 'under_review', null);
  end if;

  return v_quote;
end;
$$;

-- Replace the draft version's settings and items. `p_draft`:
-- { pricing_mode, guest_count, per_person_rate, additional_charges: [{label, amount}],
--   discount_type, discount_value, gst_rate, advance_amount, valid_until, terms, notes_to_customer,
--   items: [{dish_id?, dish_name, description?, category_name?, cuisine_name?, unit_price?, pricing_unit, quantity}] }
create or replace function public.save_quotation_draft(p_quotation_id uuid, p_draft jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qstatus  text;
  v_version  uuid;
  v_mode     text := p_draft ->> 'pricing_mode';
  v_guests   numeric;
  v_rate     numeric;
  v_charges  jsonb := coalesce(p_draft -> 'additional_charges', '[]'::jsonb);
  v_clean    jsonb := '[]'::jsonb;
  v_dtype    text := coalesce(nullif(p_draft ->> 'discount_type', ''), 'none');
  v_dvalue   numeric;
  v_gst      numeric;
  v_advance  numeric;
  v_valid    date;
  v_terms    text := nullif(btrim(coalesce(p_draft ->> 'terms', '')), '');
  v_notes    text := nullif(btrim(coalesce(p_draft ->> 'notes_to_customer', '')), '');
  v_items    jsonb := coalesce(p_draft -> 'items', '[]'::jsonb);
  c          jsonb;
  item       jsonb;
  idx        integer;
  v_label    text;
  v_amount   numeric;
  v_dish     uuid;
  v_name     text;
  v_desc     text;
  v_unit     text;
  v_price    numeric;
  v_qty      numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can edit quotations.' using errcode = '42501';
  end if;

  select q.status into v_qstatus from public.quotations q where q.id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;
  if v_qstatus = 'accepted' then
    raise exception 'This quotation was accepted and can no longer be edited.' using errcode = '22023';
  end if;

  select v.id into v_version from public.quotation_versions v
   where v.quotation_id = p_quotation_id and v.status = 'draft'
   order by v.version_number desc limit 1;
  if not found then
    raise exception 'There is no draft to edit. Start a revision first.' using errcode = '22023';
  end if;

  -- Settings ------------------------------------------------------------------
  if v_mode is null or v_mode not in ('itemised', 'per_person') then
    raise exception 'Choose how the quotation is priced.' using errcode = '22023';
  end if;

  v_guests := public.parse_quote_amount(p_draft ->> 'guest_count', 'The guest count', 1e6);
  if v_guests is null or v_guests < 1 or v_guests > 100000 or v_guests <> trunc(v_guests) then
    raise exception 'Guest count must be a whole number between 1 and 100,000.' using errcode = '22023';
  end if;

  v_rate := public.parse_quote_amount(p_draft ->> 'per_person_rate', 'The per-person rate', 1e8);
  if v_mode = 'per_person' and v_rate is null then
    raise exception 'Enter the per-person rate.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_charges) <> 'array' or jsonb_array_length(v_charges) > 20 then
    raise exception 'Add at most 20 additional charges.' using errcode = '22023';
  end if;
  for c in select value from jsonb_array_elements(v_charges) loop
    v_label := nullif(btrim(coalesce(c ->> 'label', '')), '');
    if v_label is null or char_length(v_label) > 120 then
      raise exception 'Give each additional charge a name (up to 120 characters).' using errcode = '22023';
    end if;
    v_amount := public.parse_quote_amount(c ->> 'amount', format('The amount for "%s"', v_label), 1e10);
    if v_amount is null then
      raise exception 'Enter an amount for "%".', v_label using errcode = '22023';
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object('label', v_label, 'amount', v_amount));
  end loop;

  if v_dtype not in ('none', 'amount', 'percent') then
    raise exception 'Choose a discount type.' using errcode = '22023';
  end if;
  v_dvalue := coalesce(public.parse_quote_amount(p_draft ->> 'discount_value', 'The discount', 1e10), 0);
  if v_dtype = 'none' then
    v_dvalue := 0;
  end if;
  if v_dtype = 'percent' and v_dvalue > 100 then
    raise exception 'A percentage discount can''t be more than 100%%.' using errcode = '22023';
  end if;

  v_gst := coalesce(public.parse_quote_amount(p_draft ->> 'gst_rate', 'The GST rate', 1000), 0);
  if v_gst > 28 then
    raise exception 'GST rate must be between 0%% and 28%%.' using errcode = '22023';
  end if;

  v_advance := coalesce(public.parse_quote_amount(p_draft ->> 'advance_amount', 'The advance', 1e10), 0);

  begin
    v_valid := nullif(p_draft ->> 'valid_until', '')::date;
  exception when others then
    raise exception 'Enter a valid "valid until" date.' using errcode = '22023';
  end;

  if char_length(v_terms) > 10000 then
    raise exception 'Keep the terms under 10,000 characters.' using errcode = '22023';
  end if;
  if char_length(v_notes) > 2000 then
    raise exception 'Keep the note to the customer under 2,000 characters.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 200 then
    raise exception 'A quotation can have at most 200 items.' using errcode = '22023';
  end if;

  -- Items (replaced wholesale) -------------------------------------------------
  -- Money columns are numeric(12, 2): a line, charge or total of ₹1,000 crore or more
  -- overflows. Turn that into a friendly error (the whole save is rolled back).
  begin
  delete from public.quotation_items where version_id = v_version;

  for item, idx in select value, ordinality::integer from jsonb_array_elements(v_items) with ordinality loop
    v_name := nullif(btrim(coalesce(item ->> 'dish_name', '')), '');
    if v_name is null or char_length(v_name) > 120 then
      raise exception 'Item %: enter a name (up to 120 characters).', idx using errcode = '22023';
    end if;

    v_dish := null;
    if nullif(item ->> 'dish_id', '') is not null then
      begin
        v_dish := (item ->> 'dish_id')::uuid;
      exception when others then
        raise exception 'Item "%" refers to an invalid dish.', v_name using errcode = '22023';
      end;
      -- A dish deleted from the catalogue keeps its snapshot as a custom item.
      if not exists (select 1 from public.dishes d where d.id = v_dish) then
        v_dish := null;
      end if;
    end if;

    v_desc := nullif(btrim(coalesce(item ->> 'description', '')), '');
    if char_length(v_desc) > 1000 then
      raise exception 'Keep the description of "%" under 1,000 characters.', v_name using errcode = '22023';
    end if;

    v_unit := coalesce(nullif(item ->> 'pricing_unit', ''), 'per_person');
    if v_unit not in ('per_person', 'per_plate', 'per_piece', 'per_kg', 'per_litre', 'per_tray', 'per_counter') then
      raise exception 'Choose a pricing unit for "%".', v_name using errcode = '22023';
    end if;

    v_price := public.parse_quote_amount(item ->> 'unit_price', format('The price of "%s"', v_name), 1e8);
    v_qty := public.parse_quote_amount(item ->> 'quantity', format('The quantity of "%s"', v_name), 1e6);
    if v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'The quantity of "%" must be between 0.01 and 100,000.', v_name using errcode = '22023';
    end if;

    insert into public.quotation_items (version_id, dish_id, dish_name, description, category_name, cuisine_name,
                                        unit_price, pricing_unit, quantity, sort_order)
    values (v_version, v_dish, v_name, v_desc,
            left(nullif(btrim(coalesce(item ->> 'category_name', '')), ''), 80),
            left(nullif(btrim(coalesce(item ->> 'cuisine_name', '')), ''), 80),
            v_price, v_unit, v_qty, idx);
  end loop;

  -- Settings last, so the totals are recomputed over the new items.
  update public.quotation_versions
     set pricing_mode       = v_mode,
         guest_count        = v_guests::integer,
         per_person_rate    = v_rate,
         additional_charges = v_clean,
         discount_type      = v_dtype,
         discount_value     = v_dvalue,
         gst_rate           = v_gst,
         advance_amount     = v_advance,
         valid_until        = v_valid,
         terms              = v_terms,
         notes_to_customer  = v_notes
   where id = v_version;
  exception when numeric_value_out_of_range then
    raise exception 'These amounts are too large. A line, charge or total must stay below ₹1,000 crore.'
      using errcode = '22023';
  end;
end;
$$;

create or replace function public.send_quotation(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q        record;
  v        record;
  e_status text;
  today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can send quotations.' using errcode = '42501';
  end if;

  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;
  if q.status = 'accepted' then
    raise exception 'This quotation was already accepted.' using errcode = '22023';
  end if;

  select * into v from public.quotation_versions
   where quotation_id = q.id and status = 'draft'
   order by version_number desc limit 1;
  if not found then
    raise exception 'There is no draft to send. Start a revision first.' using errcode = '22023';
  end if;

  select e.status into e_status from public.enquiries e where e.id = q.enquiry_id for update;
  if e_status not in ('submitted', 'under_review', 'quoted') then
    raise exception 'This enquiry is %, so a quotation can''t be sent.', replace(e_status, '_', ' ')
      using errcode = '22023';
  end if;

  -- Same rules as the version trigger, with messages fit for the owner.
  if not exists (select 1 from public.quotation_items i where i.version_id = v.id) then
    raise exception 'Add at least one item before sending.' using errcode = '22023';
  end if;
  if v.pricing_mode = 'itemised'
     and exists (select 1 from public.quotation_items i where i.version_id = v.id and i.unit_price is null) then
    raise exception 'Set a price for every item, or switch to per-person pricing.' using errcode = '22023';
  end if;
  if v.valid_until is null or v.valid_until < today then
    raise exception 'Set a "valid until" date from today onwards.' using errcode = '22023';
  end if;
  if v.discount_amount > v.subtotal + v.additional_charges_total then
    raise exception 'The discount can''t be more than the subtotal plus charges.' using errcode = '22023';
  end if;
  if v.advance_amount > v.total_amount then
    raise exception 'The advance can''t be more than the total.' using errcode = '22023';
  end if;

  update public.quotation_versions set status = 'superseded' where quotation_id = q.id and status = 'sent';
  update public.quotation_versions set status = 'sent' where id = v.id;
  update public.quotations
     set status = 'sent', current_version_id = v.id, customer_response_note = null, responded_at = null
   where id = q.id;

  if e_status <> 'quoted' then
    update public.enquiries set status = 'quoted' where id = q.enquiry_id;
  end if;

  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id, quotation_id)
  values (
    q.customer_id,
    case when v.version_number > 1 then 'quotation_revised' else 'quotation_sent' end,
    case when v.version_number > 1 then 'Updated quotation ' || q.quotation_number
         else 'Your quotation ' || q.quotation_number || ' is ready' end,
    'Valid until ' || to_char(v.valid_until, 'FMDD Mon YYYY') || '. Review it and let us know in your account.',
    '/account/quotations/' || q.id,
    q.enquiry_id,
    q.id
  );
end;
$$;

-- Returns the new (or already open) draft version id.
create or replace function public.create_quotation_revision(p_quotation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q        record;
  src      record;
  v_new    uuid;
  e_status text;
  today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can revise quotations.' using errcode = '42501';
  end if;

  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;
  if q.status = 'accepted' then
    raise exception 'An accepted quotation can''t be revised.' using errcode = '22023';
  end if;

  select v.id into v_new from public.quotation_versions v
   where v.quotation_id = q.id and v.status = 'draft' limit 1;
  if found then
    return v_new;
  end if;

  select e.status into e_status from public.enquiries e where e.id = q.enquiry_id;
  if e_status not in ('submitted', 'under_review', 'quoted') then
    raise exception 'This enquiry is %, so the quotation can''t be revised.', replace(e_status, '_', ' ')
      using errcode = '22023';
  end if;

  select * into src from public.quotation_versions
   where quotation_id = q.id order by version_number desc limit 1;

  insert into public.quotation_versions (quotation_id, version_number, pricing_mode, guest_count, per_person_rate,
                                         additional_charges, discount_type, discount_value, gst_rate,
                                         advance_amount, terms, notes_to_customer, valid_until)
  values (q.id, src.version_number + 1, src.pricing_mode, src.guest_count, src.per_person_rate,
          src.additional_charges, src.discount_type, src.discount_value, src.gst_rate,
          src.advance_amount, src.terms, src.notes_to_customer,
          case when src.valid_until >= today then src.valid_until else today + 14 end)
  returning id into v_new;

  insert into public.quotation_items (version_id, dish_id, dish_name, description, category_name, cuisine_name,
                                      unit_price, pricing_unit, quantity, sort_order)
  select v_new, i.dish_id, i.dish_name, i.description, i.category_name, i.cuisine_name,
         i.unit_price, i.pricing_unit, i.quantity, i.sort_order
    from public.quotation_items i
   where i.version_id = src.id;

  return v_new;
end;
$$;

create or replace function public.withdraw_quotation(p_quotation_id uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q         record;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only the owner can withdraw quotations.' using errcode = '42501';
  end if;

  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'Only a quotation awaiting the customer''s reply can be withdrawn.' using errcode = '22023';
  end if;
  if char_length(v_message) > 1000 then
    raise exception 'Keep the message to the customer under 1,000 characters.' using errcode = '22023';
  end if;

  update public.quotations set status = 'withdrawn' where id = q.id;
  update public.enquiries set status = 'under_review' where id = q.enquiry_id and status = 'quoted';

  insert into public.notifications (recipient_id, type, title, body, link, enquiry_id, quotation_id)
  values (q.customer_id, 'general', 'Quotation ' || q.quotation_number || ' was withdrawn',
          coalesce(v_message, 'We will be in touch with an updated quotation.'),
          '/account/quotations/' || q.id, q.enquiry_id, q.id);
end;
$$;

-- Returns true when the whole quotation was deleted (it had never been sent).
create or replace function public.discard_quotation_draft(p_quotation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_version uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can discard drafts.' using errcode = '42501';
  end if;

  select q.status into v_status from public.quotations q where q.id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;

  select v.id into v_version from public.quotation_versions v
   where v.quotation_id = p_quotation_id and v.status = 'draft' limit 1;
  if not found then
    raise exception 'There is no draft to discard.' using errcode = '22023';
  end if;

  if v_status = 'draft' then
    delete from public.quotations where id = p_quotation_id;
    return true;
  end if;
  delete from public.quotation_versions where id = v_version;
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- Customer: accept or decline the quotation they were sent
-- -----------------------------------------------------------------------------

create or replace function public.respond_to_quotation(p_quotation_id uuid, p_version_id uuid, p_decision text,
                                                       p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := auth.uid();
  q         record;
  v_valid   date;
  v_number  integer;
  e_status  text;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_accept  boolean := p_decision = 'accept';
  today     date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accept', 'reject') then
    raise exception 'Choose whether to accept or decline the quotation.' using errcode = '22023';
  end if;
  if char_length(v_note) > 1000 then
    raise exception 'Keep your note under 1,000 characters.' using errcode = '22023';
  end if;

  select * into q from public.quotations where id = p_quotation_id and customer_id = uid for update;
  if not found then
    raise exception 'Quotation not found.' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'This quotation is no longer open for a response.' using errcode = '22023';
  end if;
  if q.current_version_id is distinct from p_version_id then
    raise exception 'This quotation has been updated. Please review the latest version.' using errcode = '22023';
  end if;

  select v.valid_until, v.version_number into v_valid, v_number
    from public.quotation_versions v where v.id = q.current_version_id;
  if v_valid < today then
    raise exception 'This quotation expired on %. Please contact us for an updated quotation.',
      to_char(v_valid, 'FMDD Mon YYYY') using errcode = '22023';
  end if;

  select e.status into e_status from public.enquiries e where e.id = q.enquiry_id for update;
  if e_status <> 'quoted' then
    raise exception 'This enquiry is no longer open for a response.' using errcode = '22023';
  end if;

  update public.quotations
     set status = case when v_accept then 'accepted' else 'rejected' end,
         customer_response_note = v_note,
         responded_at = now()
   where id = q.id;

  if v_accept then
    -- Any unsent revision is now moot.
    delete from public.quotation_versions where quotation_id = q.id and status = 'draft';
  end if;

  update public.enquiries
     set status = case when v_accept then 'confirmed' else 'under_review' end
   where id = q.enquiry_id;

  -- Permanent record for the owner (system notes have no author and can't be edited).
  insert into public.admin_notes (enquiry_id, author_id, body)
  values (q.enquiry_id, null,
          format('Customer %s quotation %s (version %s).',
                 case when v_accept then 'accepted' else 'declined' end, q.quotation_number, v_number)
          || coalesce(E'\n\n"' || v_note || '"', ''));

  perform public.notify_admins(
    case when v_accept then 'quotation_accepted' else 'quotation_rejected' end,
    'Quotation ' || q.quotation_number || case when v_accept then ' accepted' else ' declined' end,
    coalesce(v_note, case when v_accept then 'The customer accepted the quotation. The event is confirmed.'
                          else 'The customer declined the quotation.' end),
    q.enquiry_id, q.id);

  if v_accept then
    perform public.notify_customer_of_status(q.enquiry_id, 'confirmed', null);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execute rights: helpers stay private; the API functions are for signed-in users
-- (each checks admin / ownership itself).
-- -----------------------------------------------------------------------------

revoke execute on function public.parse_quote_amount(text, text, numeric) from public, anon, authenticated;
revoke execute on function public.notify_customer_of_status(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.enquiries_guard_status() from public, anon, authenticated;

revoke execute on function public.set_enquiry_status(uuid, text, text) from public, anon;
revoke execute on function public.create_quotation(uuid) from public, anon;
revoke execute on function public.save_quotation_draft(uuid, jsonb) from public, anon;
revoke execute on function public.send_quotation(uuid) from public, anon;
revoke execute on function public.create_quotation_revision(uuid) from public, anon;
revoke execute on function public.withdraw_quotation(uuid, text) from public, anon;
revoke execute on function public.discard_quotation_draft(uuid) from public, anon;
revoke execute on function public.respond_to_quotation(uuid, uuid, text, text) from public, anon;

grant execute on function public.set_enquiry_status(uuid, text, text) to authenticated;
grant execute on function public.create_quotation(uuid) to authenticated;
grant execute on function public.save_quotation_draft(uuid, jsonb) to authenticated;
grant execute on function public.send_quotation(uuid) to authenticated;
grant execute on function public.create_quotation_revision(uuid) to authenticated;
grant execute on function public.withdraw_quotation(uuid, text) to authenticated;
grant execute on function public.discard_quotation_draft(uuid) to authenticated;
grant execute on function public.respond_to_quotation(uuid, uuid, text, text) to authenticated;
