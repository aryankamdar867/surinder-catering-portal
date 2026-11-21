const VEG = ['vegetarian', 'vegan', 'jain']

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

/** Distinct {id, name} pairs for an embedded relation ('category' | 'cuisine'), sorted by name. */
export function uniqueOptions(dishes, relation) {
  const map = new Map()
  for (const dish of dishes ?? []) if (dish[relation]) map.set(dish[relation].id, dish[relation])
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
