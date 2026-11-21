import { cn } from '@/utils/cn.js'

/**
 * The Indian veg / non-veg symbol: a square with a dot (green = veg, brown = non-veg/egg).
 * Renders nothing when a dish is neither marked vegetarian nor non-vegetarian/egg.
 */
export default function DietMark({ labels = [], className }) {
  const veg = labels.includes('vegetarian') || labels.includes('vegan') || labels.includes('jain')
  const nonVeg = labels.includes('non_vegetarian')
  const egg = labels.includes('eggetarian')
  if (!veg && !nonVeg && !egg) return null

  const isVeg = veg && !nonVeg && !egg
  const label = isVeg ? 'Vegetarian' : nonVeg ? 'Non-vegetarian' : 'Contains egg'
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center rounded-[3px] border-2 bg-white',
        isVeg ? 'border-forest-600' : 'border-burgundy-600',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', isVeg ? 'bg-forest-600' : 'bg-burgundy-600')} />
    </span>
  )
}
