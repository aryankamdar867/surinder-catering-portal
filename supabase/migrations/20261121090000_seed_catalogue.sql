-- =============================================================================
-- Surinder Caterers – Starter catalogue
-- Categories and cuisines only (no dishes or prices). Safe to re-run: existing
-- names (case-insensitive) are left untouched, so edits made in the app survive.
-- =============================================================================

insert into public.categories (name, sort_order)
values
  ('Starters', 10),
  ('Soups', 20),
  ('Main Course', 30),
  ('Breads', 40),
  ('Rice & Biryani', 50),
  ('Accompaniments', 60),
  ('Desserts', 70),
  ('Beverages', 80),
  ('Live Counters', 90)
on conflict ((lower(btrim(name)))) do nothing;

insert into public.cuisines (name, sort_order)
values
  ('North Indian', 10),
  ('South Indian', 20),
  ('Gujarati', 30),
  ('Rajasthani', 40),
  ('Punjabi', 50),
  ('Indo-Chinese', 60),
  ('Continental', 70),
  ('Italian', 80),
  ('Street Food', 90)
on conflict ((lower(btrim(name)))) do nothing;
