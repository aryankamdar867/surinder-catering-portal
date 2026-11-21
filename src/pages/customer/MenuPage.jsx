import { useMemo, useState } from 'react'
import { Search, TriangleAlert, UtensilsCrossed } from 'lucide-react'
import DietMark from '@/components/catalogue/DietMark.jsx'
import DishImage from '@/components/catalogue/DishImage.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { ALLERGENS, DIETARY_LABELS, PRICING_UNITS } from '@/constants/catalogue.js'
import { useAsync } from '@/hooks/useAsync.js'
import { categories, listDishes } from '@/services/catalogueService.js'
import { cn } from '@/utils/cn.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency } from '@/utils/format.js'
import { matchesDiet, uniqueOptions } from '@/utils/catalogue.js'

const DIET_FILTERS = [
  ['veg', 'Vegetarian'],
  ['nonveg', 'Non-veg'],
  ['jain', 'Jain'],
  ['vegan', 'Vegan'],
]
const TIER_FILTERS = [
  ['standard', 'Standard'],
  ['premium', 'Premium'],
]
// Labels already conveyed by the veg/non-veg mark.
const MARK_LABELS = ['vegetarian', 'non_vegetarian', 'eggetarian']

async function loadMenu() {
  const [categoryList, dishes] = await Promise.all([categories.list(), listDishes()])
  // RLS hides inactive categories/cuisines from customers, so their embeds come back null.
  return { categoryList, dishes: dishes.filter((d) => d.category && d.cuisine) }
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active ? 'border-forest-700 bg-forest-800 text-ivory-50' : 'border-ivory-300 bg-white text-ink-700 hover:border-forest-600',
      )}
    >
      {children}
    </button>
  )
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{label}</span>
      <FilterChip active={!value} onClick={() => onChange('')}>
        All
      </FilterChip>
      {options.map(([key, text]) => (
        <FilterChip key={key} active={value === key} onClick={() => onChange(value === key ? '' : key)}>
          {text}
        </FilterChip>
      ))}
    </div>
  )
}

export default function MenuPage() {
  const { data, error, loading, reload } = useAsync(loadMenu)
  const [q, setQ] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [diet, setDiet] = useState('')
  const [tier, setTier] = useState('')

  const cuisineOptions = useMemo(() => uniqueOptions(data?.dishes, 'cuisine').map((c) => [c.id, c.name]), [data])

  const sections = useMemo(() => {
    if (!data) return []
    const term = q.trim().toLowerCase()
    const matches = data.dishes.filter(
      (d) =>
        (!term || d.name.toLowerCase().includes(term) || d.description?.toLowerCase().includes(term)) &&
        (!cuisine || d.cuisine_id === cuisine) &&
        (!tier || d.tier === tier) &&
        matchesDiet(d, diet),
    )
    return data.categoryList
      .map((category) => ({
        category,
        // Available dishes first, then alphabetical.
        dishes: matches
          .filter((d) => d.category_id === category.id)
          .sort((a, b) => Number(b.is_available) - Number(a.is_available) || a.name.localeCompare(b.name)),
      }))
      .filter((s) => s.dishes.length > 0)
  }, [data, q, cuisine, diet, tier])

  if (loading && !data) return <PageLoader label="Loading the menu…" />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load the menu"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  const filtered = Boolean(q || cuisine || diet || tier)
  const clear = () => {
    setQ('')
    setCuisine('')
    setDiet('')
    setTier('')
  }

  return (
    <>
      <PageHeader
        eyebrow="Our menu"
        title="Browse dishes"
        description="Explore what we cook. You'll be able to pick dishes for your event when you send an enquiry."
      />

      {data.dishes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Our menu is being prepared"
          message="Dishes will appear here soon. Please check back shortly."
        />
      ) : (
        <>
          <div className="mb-8 space-y-4 rounded-2xl border border-ivory-200 bg-white/70 p-4 sm:p-5">
            <Field
              label="Search the menu"
              name="q"
              type="search"
              placeholder="e.g. paneer, biryani, gulab jamun"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              trailing={<Search className="mr-2.5 size-4 text-ink-400" aria-hidden="true" />}
            />
            {cuisineOptions.length > 1 && (
              <ChipGroup label="Cuisine" options={cuisineOptions} value={cuisine} onChange={setCuisine} />
            )}
            <ChipGroup label="Diet" options={DIET_FILTERS} value={diet} onChange={setDiet} />
            <ChipGroup label="Range" options={TIER_FILTERS} value={tier} onChange={setTier} />
          </div>

          {sections.length > 1 && (
            <nav aria-label="Menu sections" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
              {sections.map(({ category, dishes }) => (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  className="shrink-0 rounded-full bg-ivory-100 px-3.5 py-1.5 text-sm font-medium text-forest-800 hover:bg-ivory-200"
                >
                  {category.name} <span className="text-ink-400">{dishes.length}</span>
                </a>
              ))}
            </nav>
          )}

          {sections.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No dishes match"
              message="Try another search or remove a filter."
              action={
                filtered && (
                  <Button variant="secondary" onClick={clear}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-12">
              {sections.map(({ category, dishes }) => (
                <section key={category.id} id={`cat-${category.id}`} aria-labelledby={`cat-${category.id}-title`} className="scroll-mt-28">
                  <h2 id={`cat-${category.id}-title`} className="text-3xl font-semibold text-forest-900">
                    {category.name}
                  </h2>
                  {category.description && <p className="mt-1 text-sm text-ink-500">{category.description}</p>}
                  <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {dishes.map((dish) => (
                      <DishCard key={dish.id} dish={dish} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function DishCard({ dish }) {
  const extraLabels = dish.dietary_labels.filter((l) => !MARK_LABELS.includes(l))
  return (
    <li
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-ivory-200 bg-white shadow-card',
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
        <p className="mt-auto pt-4 text-sm">
          <span className="text-lg font-semibold text-forest-800">{formatCurrency(dish.price)}</span>{' '}
          <span className="text-ink-400">{PRICING_UNITS[dish.pricing_unit]}</span>
        </p>
      </div>
    </li>
  )
}
