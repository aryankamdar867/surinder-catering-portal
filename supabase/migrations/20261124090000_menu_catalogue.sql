-- =============================================================================
-- Surinder Caterers – Official menu catalogue support
--
-- Prepares public.dishes for the customer-facing menu workbook
-- (Menu_Portal_Classification.xlsx, imported by supabase/imports/menu_portal_classification.sql):
--
-- * price may be NULL ("price on request"). The workbook has no prices and the
--   business sets them later. A NULL price is snapshotted as a NULL unit_price on
--   enquiry menu selections; estimated totals then cover priced dishes only.
-- * Five descriptive columns from the workbook: base ingredients, taste profile,
--   texture, cooking method and region / origin.
-- * Dish names are unique per category instead of globally: the workbook lists
--   some dishes (e.g. Pudina Raita) under two courses.
--
-- Quotation items keep unit_price NOT NULL on purpose: a quotation needs a price.
-- Safe to re-run.
-- =============================================================================

alter table public.dishes alter column price drop not null;

alter table public.dishes
  add column if not exists base_ingredients text,
  add column if not exists taste_profile    text,
  add column if not exists texture          text,
  add column if not exists cooking_method   text,
  add column if not exists region_origin    text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dishes_attributes_length'
                   and conrelid = 'public.dishes'::regclass) then
    alter table public.dishes add constraint dishes_attributes_length check (
      char_length(base_ingredients) <= 200 and char_length(taste_profile) <= 200
      and char_length(texture) <= 200 and char_length(cooking_method) <= 200
      and char_length(region_origin) <= 200);
  end if;
end;
$$;

drop index if exists public.dishes_name_key;
create unique index if not exists dishes_category_name_key on public.dishes (category_id, lower(btrim(name)));
create index if not exists dishes_name_idx on public.dishes (lower(btrim(name)));

alter table public.menu_selections alter column unit_price drop not null;
