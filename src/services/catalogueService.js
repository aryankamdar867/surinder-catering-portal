import { supabase } from '@/lib/supabase.js'

// RLS: any signed-in user may read (customers only see active categories/cuisines);
// only admins may write. These functions never decide access themselves.

const GROUP_COLUMNS = 'id, name, description, sort_order, is_active, created_at, updated_at'
const GROUP_EDITABLE = ['name', 'description', 'sort_order', 'is_active']

const DISH_COLUMNS =
  'id, name, description, category_id, cuisine_id, price, pricing_unit, dietary_labels, allergens, tier, ' +
  'is_available, image_path, created_at, updated_at, category:categories(id, name), cuisine:cuisines(id, name)'
const DISH_EDITABLE = [
  'name',
  'description',
  'category_id',
  'cuisine_id',
  'price',
  'pricing_unit',
  'dietary_labels',
  'allergens',
  'tier',
  'is_available',
  'image_path',
]

const pick = (values, allowed) => Object.fromEntries(Object.entries(values).filter(([key]) => allowed.includes(key)))

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

// --- Categories and cuisines share one shape --------------------------------

function groupApi(table) {
  return {
    list: () => run(supabase.from(table).select(GROUP_COLUMNS).order('sort_order').order('name')),
    create: (values) => run(supabase.from(table).insert(pick(values, GROUP_EDITABLE)).select(GROUP_COLUMNS).single()),
    update: (id, values) =>
      run(supabase.from(table).update(pick(values, GROUP_EDITABLE)).eq('id', id).select(GROUP_COLUMNS).single()),
    remove: (id) => run(supabase.from(table).delete().eq('id', id)),
  }
}

export const categories = groupApi('categories')
export const cuisines = groupApi('cuisines')

// --- Dishes -----------------------------------------------------------------

export function listDishes() {
  return run(supabase.from('dishes').select(DISH_COLUMNS).order('name'))
}

export function getDish(id) {
  return run(supabase.from('dishes').select(DISH_COLUMNS).eq('id', id).single())
}

export function createDish(values) {
  return run(supabase.from('dishes').insert(pick(values, DISH_EDITABLE)).select(DISH_COLUMNS).single())
}

export function updateDish(id, values) {
  return run(supabase.from('dishes').update(pick(values, DISH_EDITABLE)).eq('id', id).select(DISH_COLUMNS).single())
}

export function deleteDish(id) {
  return run(supabase.from('dishes').delete().eq('id', id))
}

/** Number of dishes using each category / cuisine, for "in use" checks. */
export async function countDishesBy(column) {
  const rows = await run(supabase.from('dishes').select(column))
  return rows.reduce((acc, row) => ((acc[row[column]] = (acc[row[column]] ?? 0) + 1), acc), {})
}
