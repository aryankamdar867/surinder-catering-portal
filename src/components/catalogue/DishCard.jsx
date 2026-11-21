import DietMark from './DietMark.jsx'
import DishImage from './DishImage.jsx'
import Badge from '@/components/ui/Badge.jsx'
import { ALLERGENS, DIETARY_LABELS, PRICING_UNITS } from '@/constants/catalogue.js'
import { cn } from '@/utils/cn.js'
import { formatCurrency } from '@/utils/format.js'

// Labels already conveyed by the veg/non-veg mark.
const MARK_LABELS = ['vegetarian', 'non_vegetarian', 'eggetarian']

/** Customer-facing dish card (renders an <li>). `action` adds a footer control, e.g. an Add button. */
export default function DishCard({ dish, action, selected = false }) {
  const extraLabels = dish.dietary_labels.filter((l) => !MARK_LABELS.includes(l))
  return (
    <li
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition',
        selected ? 'border-forest-600 ring-2 ring-forest-600/20' : 'border-ivory-200',
        !dish.is_available && 'opacity-60',
      )}
    >
      <div className="relative">
        <DishImage path={dish.image_path} alt={dish.name} className="aspect-[4/3] w-full" />
        {dish.tier === 'premium' && <Badge tone="gold" className="absolute left-3 top-3 bg-ivory-50">Premium</Badge>}
        {!dish.is_available && (
          <Badge tone="burgundy" className="absolute right-3 top-3 bg-ivory-50">
            Currently unavailable
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <DietMark labels={dish.dietary_labels} className="mt-1" />
          <h3 className="font-sans text-base font-semibold tracking-normal text-ink-900">{dish.name}</h3>
        </div>
        <p className="mt-0.5 text-xs text-ink-400">{dish.cuisine.name}</p>
        {dish.description && <p className="mt-2 line-clamp-3 text-sm text-ink-500">{dish.description}</p>}
        {extraLabels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {extraLabels.map((l) => (
              <Badge key={l} tone="forest">
                {DIETARY_LABELS[l]}
              </Badge>
            ))}
          </div>
        )}
        {dish.allergens.length > 0 && (
          <p className="mt-2 text-xs text-ink-500">
            <span className="font-medium text-ink-700">Contains:</span>{' '}
            {dish.allergens.map((a) => ALLERGENS[a]).join(', ')}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="text-sm">
            <span className="text-lg font-semibold text-forest-800">{formatCurrency(dish.price)}</span>{' '}
            <span className="text-ink-400">{PRICING_UNITS[dish.pricing_unit]}</span>
          </p>
          {action}
        </div>
      </div>
    </li>
  )
}
