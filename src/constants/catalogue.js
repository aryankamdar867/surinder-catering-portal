// Labels for catalogue values. Keys MUST match the CHECK constraints on
// public.dishes in supabase/migrations/20261120090000_core_schema.sql.

export const PRICING_UNITS = {
  per_person: 'per person',
  per_plate: 'per plate',
  per_piece: 'per piece',
  per_kg: 'per kg',
  per_litre: 'per litre',
  per_tray: 'per tray',
  per_counter: 'per counter',
}

export const DIETARY_LABELS = {
  vegetarian: 'Vegetarian',
  non_vegetarian: 'Non-vegetarian',
  eggetarian: 'Contains egg',
  vegan: 'Vegan',
  jain: 'Jain',
  gluten_free: 'Gluten-free',
  dairy_free: 'Dairy-free',
  nut_free: 'Nut-free',
  halal: 'Halal',
}

export const ALLERGENS = {
  gluten: 'Gluten',
  dairy: 'Dairy',
  nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  soy: 'Soy',
  eggs: 'Eggs',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
  mustard: 'Mustard',
  celery: 'Celery',
  sulphites: 'Sulphites',
}

export const TIERS = {
  standard: 'Standard',
  premium: 'Premium',
}

/** Labels that cannot be combined (also enforced by the database). */
export const EXCLUSIVE_DIETARY = [['vegetarian', 'non_vegetarian']]

export const DISH_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const DISH_IMAGE_MAX_BYTES = 5 * 1024 * 1024
