const VEG = ['vegetarian', 'vegan', 'jain']

export const DIET_FILTERS = [
  ['veg', 'Vegetarian'],
  ['nonveg', 'Non-veg'],
  ['jain', 'Jain'],
  ['vegan', 'Vegan'],
]

export const TIER_FILTERS = [
  ['standard', 'Standard'],
  ['premium', 'Premium'],
]

export const isVegetarian = (dish) =>
  dish.dietary_labels.some((l) => VEG.includes(l)) &&
  !dish.dietary_labels.includes('non_vegetarian') &&
  !dish.dietary_labels.includes('eggetarian')

/** `diet`: '' (any), 'veg', 'nonveg', or a specific dietary label such as 'jain'. */
export function matchesDiet(dish, diet) {
  if (!diet) return true
  if (diet === 'veg') return isVegetarian(dish)
  if (diet === 'nonveg') return dish.dietary_labels.includes('non_vegetarian') || dish.dietary_labels.includes('eggetarian')
  return dish.dietary_labels.includes(diet)
}

export function matchesSearch(dish, query) {
  const term = query.trim().toLowerCase()
  return !term || dish.name.toLowerCase().includes(term) || Boolean(dish.description?.toLowerCase().includes(term))
}

/** Distinct {id, name} pairs for an embedded relation ('category' | 'cuisine'), sorted by name. */
export function uniqueOptions(dishes, relation) {
  const map = new Map()
  for (const dish of dishes ?? []) if (dish[relation]) map.set(dish[relation].id, dish[relation])
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** [{ category, dishes }] in category order; available dishes first, then A–Z. Empty sections dropped. */
export function groupByCategory(categoryList, dishes) {
  return categoryList
    .map((category) => ({
      category,
      dishes: dishes
        .filter((d) => d.category_id === category.id)
        .sort((a, b) => Number(b.is_available) - Number(a.is_available) || a.name.localeCompare(b.name)),
    }))
    .filter((s) => s.dishes.length > 0)
}
