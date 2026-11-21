import { PRICING_UNITS } from '@/constants/catalogue.js'
import { formatCurrency } from '@/utils/format.js'

const VEG = ['vegetarian', 'vegan', 'jain']

/** Dishes from the official menu start without a price ("price on request"). */
export const hasPrice = (price) => price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price))

/** "₹120 per person", or "Price on request" when no price is set yet. */
export const priceLabel = (price, unit) =>
  hasPrice(price) ? `${formatCurrency(price)} ${PRICING_UNITS[unit] ?? ''}`.trim() : 'Price on request'

/** Short descriptive line built only from the menu's own fields (never invented). */
export const dishDetails = (dish) => [dish.base_ingredients, dish.taste_profile].filter(Boolean).join(' · ')

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
  return (
    !term ||
    [dish.name, dish.description, dish.base_ingredients, dish.taste_profile, dish.region_origin].some((v) =>
      v?.toLowerCase().includes(term),
    )
  )
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
