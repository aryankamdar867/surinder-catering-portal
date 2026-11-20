-- =============================================================================
-- Surinder Caterers – core schema
-- Tables, constraints, indexes and integrity triggers.
-- Row Level Security policies live in the next migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles – one row per auth user. Role is admin-controlled (see protections).
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text not null default '' check (char_length(full_name) <= 120),
  phone         text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  address       text check (char_length(address) <= 500),
  company_name  text check (char_length(company_name) <= 150),
  gst_number    text check (gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  role          text not null default 'customer' check (role in ('customer', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_admin_idx on public.profiles (id) where role = 'admin';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Is the current request made by an admin? SECURITY DEFINER so it can read
-- profiles without recursing through RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Create a customer profile for every new auth user. Role is always 'customer';
-- admins are promoted manually in the Supabase SQL editor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_phone text := btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120),
    case when meta_phone ~ '^\+?[0-9 ()-]{7,20}$' then meta_phone end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when a user changes their login email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Defence in depth (column privileges already block this): API users can never
-- change id, email or role. Only trusted roles (SQL editor / service) can.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.id is distinct from old.id
          or new.email is distinct from old.email
          or new.role is distinct from old.role) then
    raise exception 'Not allowed to change protected profile fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- -----------------------------------------------------------------------------
-- Catalogue: categories, cuisines, dishes
-- -----------------------------------------------------------------------------

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  description  text check (char_length(description) <= 500),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index categories_name_key on public.categories (lower(btrim(name)));

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.cuisines (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  description  text check (char_length(description) <= 500),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index cuisines_name_key on public.cuisines (lower(btrim(name)));

create trigger cuisines_set_updated_at
  before update on public.cuisines
  for each row execute function public.set_updated_at();

create table public.dishes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  description     text check (char_length(description) <= 1000),
  category_id     uuid not null references public.categories (id) on delete restrict,
  cuisine_id      uuid not null references public.cuisines (id) on delete restrict,
  price           numeric(10, 2) not null check (price >= 0),
  pricing_unit    text not null default 'per_person'
                  check (pricing_unit in ('per_person', 'per_plate', 'per_piece', 'per_kg',
                                          'per_litre', 'per_tray', 'per_counter')),
  dietary_labels  text[] not null default '{}'
                  check (dietary_labels <@ array['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan',
                                                 'jain', 'gluten_free', 'dairy_free', 'nut_free',
                                                 'halal']::text[]
                         and not dietary_labels @> array['vegetarian', 'non_vegetarian']::text[]),
  allergens       text[] not null default '{}'
                  check (allergens <@ array['gluten', 'dairy', 'nuts', 'peanuts', 'soy', 'eggs', 'fish',
                                            'shellfish', 'sesame', 'mustard', 'celery',
                                            'sulphites']::text[]),
  tier            text not null default 'standard' check (tier in ('standard', 'premium')),
  is_available    boolean not null default true,
  image_path      text check (char_length(image_path) <= 300),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index dishes_name_key on public.dishes (lower(btrim(name)));
create index dishes_category_idx on public.dishes (category_id);
create index dishes_cuisine_idx on public.dishes (cuisine_id);
create index dishes_available_idx on public.dishes (is_available, tier);
create index dishes_dietary_idx on public.dishes using gin (dietary_labels);

create trigger dishes_set_updated_at
  before update on public.dishes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Human-readable reference numbers (SCE-2026-00001, SCQ-2026-00001)
-- -----------------------------------------------------------------------------

create sequence public.enquiry_number_seq;
create sequence public.quotation_number_seq;

create or replace function public.next_reference(prefix text, seq regclass)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval(seq)::text, 5, '0');
$$;

-- -----------------------------------------------------------------------------
-- Enquiries
-- Contact details are snapshotted so later profile edits don't rewrite history.
-- Customers create enquiries through a validated RPC (Phase 5), not direct inserts.
-- -----------------------------------------------------------------------------

create table public.enquiries (
  id                    uuid primary key default gen_random_uuid(),
  enquiry_number        text not null unique,
  customer_id           uuid not null references public.profiles (id) on delete restrict,
  status                text not null default 'submitted'
                        check (status in ('submitted', 'under_review', 'quoted', 'confirmed',
                                          'completed', 'cancelled', 'declined')),
  contact_name          text not null check (char_length(btrim(contact_name)) between 2 and 120),
  contact_phone         text not null check (contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  contact_email         text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                                             and char_length(contact_email) <= 254),
  address               text check (char_length(address) <= 500),
  company_name          text check (char_length(company_name) <= 150),
  gst_number            text check (gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  total_budget          numeric(12, 2) check (total_budget >= 0),
  per_person_budget     numeric(10, 2) check (per_person_budget >= 0),
  budget_flexibility    text not null default 'flexible'
                        check (budget_flexibility in ('strict', 'flexible', 'premium')),
  estimated_menu_total  numeric(12, 2) not null default 0,
  submitted_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index enquiries_customer_idx on public.enquiries (customer_id, created_at desc);
create index enquiries_status_idx on public.enquiries (status, created_at desc);

create or replace function public.enquiries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.enquiry_number := public.next_reference('SCE', 'public.enquiry_number_seq');
  new.estimated_menu_total := 0;  -- maintained from menu_selections
  return new;
end;
$$;

create trigger enquiries_before_insert
  before insert on public.enquiries
  for each row execute function public.enquiries_before_insert();

create or replace function public.enquiries_protect_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.enquiry_number is distinct from old.enquiry_number
     or new.customer_id is distinct from old.customer_id
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'enquiry_number, customer_id and submitted_at cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enquiries_protect_fields
  before update on public.enquiries
  for each row execute function public.enquiries_protect_fields();

create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

create table public.event_details (
  id                    uuid primary key default gen_random_uuid(),
  enquiry_id            uuid not null unique references public.enquiries (id) on delete cascade,
  event_type            text not null
                        check (event_type in ('wedding', 'reception', 'engagement', 'sangeet', 'mehendi',
                                              'birthday', 'anniversary', 'corporate', 'religious',
                                              'housewarming', 'festival', 'other')),
  event_type_other      text check (char_length(event_type_other) <= 80),
  event_date            date not null,
  event_time            time,
  venue_name            text not null check (char_length(btrim(venue_name)) between 1 and 200),
  venue_address         text check (char_length(venue_address) <= 500),
  guest_count           integer not null check (guest_count between 1 and 100000),
  service_type          text not null
                        check (service_type in ('buffet', 'plated', 'live_counters', 'family_style',
                                                'packed_meals', 'mixed')),
  cuisine_preferences   text[] not null default '{}',
  dietary_requirements  text check (char_length(dietary_requirements) <= 1000),
  special_instructions  text check (char_length(special_instructions) <= 2000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (event_type <> 'other' or char_length(btrim(event_type_other)) > 0)
);

create index event_details_date_idx on public.event_details (event_date);

create trigger event_details_set_updated_at
  before update on public.event_details
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Menu selections – immutable snapshots of the dishes chosen for an enquiry.
-- Name and price always come from the dishes table, never from the client.
-- -----------------------------------------------------------------------------

create table public.menu_selections (
  id              uuid primary key default gen_random_uuid(),
  enquiry_id      uuid not null references public.enquiries (id) on delete cascade,
  dish_id         uuid references public.dishes (id) on delete set null,
  dish_name       text not null,
  category_name   text not null,
  cuisine_name    text not null,
  unit_price      numeric(10, 2) not null check (unit_price >= 0),
  pricing_unit    text not null,
  dietary_labels  text[] not null default '{}',
  tier            text not null,
  quantity        numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  line_total      numeric(12, 2) generated always as (round(unit_price * quantity, 2)) stored,
  source          text not null default 'customer' check (source in ('customer', 'ai')),
  created_at      timestamptz not null default now()
);

create unique index menu_selections_enquiry_dish_key on public.menu_selections (enquiry_id, dish_id);
create index menu_selections_dish_idx on public.menu_selections (dish_id);

create or replace function public.menu_selections_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  d record;
begin
  if tg_op = 'INSERT' then
    select dsh.name, dsh.price, dsh.pricing_unit, dsh.dietary_labels, dsh.tier, dsh.is_available,
           cat.name as category_name, cui.name as cuisine_name
      into d
      from public.dishes dsh
      join public.categories cat on cat.id = dsh.category_id
      join public.cuisines cui on cui.id = dsh.cuisine_id
     where dsh.id = new.dish_id;

    if not found then
      raise exception 'Dish % does not exist', new.dish_id using errcode = '23503';
    end if;
    if not d.is_available then
      raise exception 'Dish "%" is currently unavailable', d.name using errcode = '23514';
    end if;

    -- Overwrite anything the caller supplied with authoritative values.
    new.dish_name      := d.name;
    new.unit_price     := d.price;
    new.pricing_unit   := d.pricing_unit;
    new.dietary_labels := d.dietary_labels;
    new.tier           := d.tier;
    new.category_name  := d.category_name;
    new.cuisine_name   := d.cuisine_name;
    return new;
  end if;

  -- UPDATE: rows are immutable, except the FK being nulled when a dish is deleted.
  if old.dish_id is not null and new.dish_id is null
     and (to_jsonb(new) - array['dish_id', 'line_total']) = (to_jsonb(old) - array['dish_id', 'line_total']) then
    return new;
  end if;
  raise exception 'Menu selections cannot be modified after submission' using errcode = '42501';
end;
$$;

create trigger menu_selections_snapshot
  before insert or update on public.menu_selections
  for each row execute function public.menu_selections_snapshot();

create or replace function public.menu_selections_refresh_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.enquiry_id, old.enquiry_id);
begin
  update public.enquiries
     set estimated_menu_total = (
       select coalesce(sum(line_total), 0) from public.menu_selections where enquiry_id = target
     )
   where id = target;
  return null;
end;
$$;

create trigger menu_selections_refresh_total
  after insert or delete on public.menu_selections
  for each row execute function public.menu_selections_refresh_total();

-- -----------------------------------------------------------------------------
-- Enquiry status history (written automatically by trigger)
-- -----------------------------------------------------------------------------

create table public.enquiry_status_history (
  id           uuid primary key default gen_random_uuid(),
  enquiry_id   uuid not null references public.enquiries (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index enquiry_status_history_enquiry_idx on public.enquiry_status_history (enquiry_id, created_at);

create or replace function public.enquiries_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.enquiry_status_history (enquiry_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger enquiries_log_status
  after insert or update of status on public.enquiries
  for each row execute function public.enquiries_log_status();

-- -----------------------------------------------------------------------------
-- Admin notes (internal, never visible to customers)
-- -----------------------------------------------------------------------------

create table public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references public.enquiries (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index admin_notes_enquiry_idx on public.admin_notes (enquiry_id, created_at desc);

create trigger admin_notes_set_updated_at
  before update on public.admin_notes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Quotations
--   quotations          – header, one per offer for an enquiry
--   quotation_versions  – each revision; locked once sent
--   quotation_items     – dish snapshots for a version
-- All money totals are computed in the database, never trusted from the client.
-- -----------------------------------------------------------------------------

create table public.quotations (
  id                      uuid primary key default gen_random_uuid(),
  quotation_number        text not null unique,
  enquiry_id              uuid not null references public.enquiries (id) on delete restrict,
  customer_id             uuid not null references public.profiles (id) on delete restrict,
  status                  text not null default 'draft'
                          check (status in ('draft', 'sent', 'accepted', 'rejected', 'withdrawn', 'expired')),
  current_version_id      uuid,
  customer_response_note  text check (char_length(customer_response_note) <= 1000),
  responded_at            timestamptz,
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index quotations_enquiry_idx on public.quotations (enquiry_id);
create index quotations_customer_idx on public.quotations (customer_id, status);
create index quotations_status_idx on public.quotations (status, created_at desc);

create or replace function public.quotations_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.quotation_number := public.next_reference('SCQ', 'public.quotation_number_seq');
    select customer_id into new.customer_id from public.enquiries where id = new.enquiry_id;
  elsif new.quotation_number is distinct from old.quotation_number
        or new.enquiry_id is distinct from old.enquiry_id
        or new.customer_id is distinct from old.customer_id then
    raise exception 'quotation_number, enquiry_id and customer_id cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger quotations_before_write
  before insert or update on public.quotations
  for each row execute function public.quotations_before_write();

create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

create table public.quotation_versions (
  id                        uuid primary key default gen_random_uuid(),
  quotation_id              uuid not null references public.quotations (id) on delete cascade,
  version_number            integer not null check (version_number > 0),
  status                    text not null default 'draft' check (status in ('draft', 'sent', 'superseded')),
  pricing_mode              text not null default 'itemised' check (pricing_mode in ('itemised', 'per_person')),
  guest_count               integer not null check (guest_count between 1 and 100000),
  per_person_rate           numeric(10, 2) check (per_person_rate >= 0),
  items_total               numeric(12, 2) not null default 0,
  subtotal                  numeric(12, 2) not null default 0,
  additional_charges        jsonb not null default '[]'::jsonb check (jsonb_typeof(additional_charges) = 'array'),
  additional_charges_total  numeric(12, 2) not null default 0,
  discount_type             text not null default 'none' check (discount_type in ('none', 'amount', 'percent')),
  discount_value            numeric(12, 2) not null default 0 check (discount_value >= 0),
  discount_amount           numeric(12, 2) not null default 0,
  taxable_amount            numeric(12, 2) not null default 0,
  gst_rate                  numeric(5, 2) not null default 0 check (gst_rate between 0 and 28),
  gst_amount                numeric(12, 2) not null default 0,
  total_amount              numeric(12, 2) not null default 0,
  advance_amount            numeric(12, 2) not null default 0 check (advance_amount >= 0),
  balance_amount            numeric(12, 2) not null default 0,
  terms                     text check (char_length(terms) <= 10000),
  notes_to_customer         text check (char_length(notes_to_customer) <= 2000),
  valid_until               date,
  sent_at                   timestamptz,
  created_by                uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (quotation_id, version_number),
  check (pricing_mode <> 'per_person' or per_person_rate is not null),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (status = 'draft' or valid_until is not null)
);

alter table public.quotations
  add constraint quotations_current_version_fk
  foreign key (current_version_id) references public.quotation_versions (id) on delete set null;

create index quotation_versions_quotation_idx on public.quotation_versions (quotation_id, version_number desc);

-- Compute all totals; lock versions once they leave 'draft'.
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

  -- Drafts may be temporarily inconsistent while being built (items are added
  -- after the version row). Everything must be valid before it is sent.
  if new.status = 'sent' then
    if not exists (select 1 from public.quotation_items where version_id = new.id) then
      raise exception 'Add at least one menu item before sending the quotation' using errcode = '23514';
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

create trigger quotation_versions_before_write
  before insert or update on public.quotation_versions
  for each row execute function public.quotation_versions_before_write();

create or replace function public.quotation_versions_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Sent quotation versions cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger quotation_versions_before_delete
  before delete on public.quotation_versions
  for each row execute function public.quotation_versions_before_delete();

create table public.quotation_items (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.quotation_versions (id) on delete cascade,
  dish_id        uuid references public.dishes (id) on delete set null,
  dish_name      text not null check (char_length(btrim(dish_name)) between 1 and 120),
  description    text check (char_length(description) <= 1000),
  category_name  text,
  cuisine_name   text,
  unit_price     numeric(10, 2) not null check (unit_price >= 0),
  pricing_unit   text not null,
  quantity       numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  line_total     numeric(12, 2) generated always as (round(unit_price * quantity, 2)) stored,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index quotation_items_version_idx on public.quotation_items (version_id, sort_order);
create index quotation_items_dish_idx on public.quotation_items (dish_id);

-- Fill snapshot fields from the catalogue (admin may override price/name),
-- and block edits to items of versions that are no longer drafts.
create or replace function public.quotation_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  d record;
begin
  if tg_op = 'UPDATE' and old.dish_id is not null and new.dish_id is null
     and (to_jsonb(new) - array['dish_id', 'line_total']) = (to_jsonb(old) - array['dish_id', 'line_total']) then
    return new;  -- dish deleted from catalogue; snapshot stays intact
  end if;

  select status into v_status from public.quotation_versions
   where id = case when tg_op = 'DELETE' then old.version_id else new.version_id end;

  if v_status is not null and v_status <> 'draft' then
    raise exception 'Items of a sent quotation version cannot be changed' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
    raise exception 'Quotation items cannot be moved between versions' using errcode = '42501';
  end if;

  if new.dish_id is not null and (tg_op = 'INSERT' or new.dish_id is distinct from old.dish_id) then
    select dsh.name, dsh.description, dsh.price, dsh.pricing_unit,
           cat.name as category_name, cui.name as cuisine_name
      into d
      from public.dishes dsh
      join public.categories cat on cat.id = dsh.category_id
      join public.cuisines cui on cui.id = dsh.cuisine_id
     where dsh.id = new.dish_id;

    if found then
      new.dish_name     := coalesce(new.dish_name, d.name);
      new.description   := coalesce(new.description, d.description);
      new.unit_price    := coalesce(new.unit_price, d.price);
      new.pricing_unit  := coalesce(new.pricing_unit, d.pricing_unit);
      new.category_name := coalesce(new.category_name, d.category_name);
      new.cuisine_name  := coalesce(new.cuisine_name, d.cuisine_name);
    end if;
  end if;
  return new;
end;
$$;

create trigger quotation_items_before_write
  before insert or update or delete on public.quotation_items
  for each row execute function public.quotation_items_before_write();

-- Recalculate the parent draft version whenever its items change.
create or replace function public.quotation_items_refresh_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.quotation_versions
     set updated_at = now()
   where id in (new.version_id, old.version_id) and status = 'draft';
  return null;
end;
$$;

create trigger quotation_items_refresh_version
  after insert or update or delete on public.quotation_items
  for each row execute function public.quotation_items_refresh_version();

-- -----------------------------------------------------------------------------
-- Notifications (created by server-side functions only)
-- -----------------------------------------------------------------------------

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  type          text not null
                check (type in ('enquiry_submitted', 'enquiry_status_changed', 'quotation_sent',
                                'quotation_revised', 'quotation_accepted', 'quotation_rejected',
                                'event_reminder', 'general')),
  title         text not null check (char_length(title) between 1 and 160),
  body          text check (char_length(body) <= 1000),
  link          text check (char_length(link) <= 300),
  enquiry_id    uuid references public.enquiries (id) on delete cascade,
  quotation_id  uuid references public.quotations (id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
