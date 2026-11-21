import { useMemo, useState } from 'react'
import { Check, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import DietMark from '@/components/catalogue/DietMark.jsx'
import DishCard from '@/components/catalogue/DishCard.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import ChipGroup from '@/components/ui/FilterChips.jsx'
import { PRICING_UNITS, QUANTITY_UNITS } from '@/constants/catalogue.js'
import { defaultQuantity } from '@/constants/enquiry.js'
import { formatCurrency } from '@/utils/format.js'
import { DIET_FILTERS, groupByCategory, matchesDiet, matchesSearch } from '@/utils/catalogue.js'
import { estimateTotal } from './enquiryDraft.js'

export default function MenuStep({ menu, selection, guests, errors, onChange }) {
  const [q, setQ] = useState('')
  const [diet, setDiet] = useState('')
  const [category, setCategory] = useState('')

  const dishById = useMemo(() => new Map(menu.dishes.map((d) => [d.id, d])), [menu])
  const selectedIds = new Set(selection.map((s) => s.dish_id))
  const total = estimateTotal(selection, dishById)

  const sections = useMemo(() => {
    const matches = menu.dishes.filter((d) => matchesSearch(d, q) && matchesDiet(d, diet) && (!category || d.category_id === category))
    return groupByCategory(menu.categoryList, matches)
  }, [menu, q, diet, category])

  const add = (dish) => onChange([...selection, { dish_id: dish.id, quantity: String(defaultQuantity(dish.pricing_unit, guests)) }])
  const remove = (id) => onChange(selection.filter((s) => s.dish_id !== id))
  const setQty = (id, quantity) => onChange(selection.map((s) => (s.dish_id === id ? { ...s, quantity } : s)))

  if (menu.dishes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Our online menu is being prepared"
        message="No problem – continue and our team will suggest a menu for your event."
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Selection first on mobile so it's never lost below a long list. */}
      <aside className="lg:sticky lg:top-24 lg:order-2 lg:self-start">
        <Card>
          <CardHeader
            title="Your selection"
            description={selection.length ? `${selection.length} ${selection.length === 1 ? 'dish' : 'dishes'}` : 'Optional'}
          />
          <CardBody className="space-y-4">
            {errors.dishes && <Alert tone="error">{errors.dishes}</Alert>}
            {selection.length === 0 ? (
              <p className="text-sm text-ink-500">
                Add dishes you'd like, or skip this step and we'll suggest a menu for {guests || 'your'} guests.
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1" aria-label="Selected dishes">
                {selection.map((s) => {
                  const dish = dishById.get(s.dish_id)
                  if (!dish) return null
                  const qtyError = errors[`qty-${s.dish_id}`]
                  return (
                    <li key={s.dish_id} className="rounded-xl border border-ivory-200 bg-white p-3">
                      <div className="flex items-start gap-2">
                        <DietMark labels={dish.dietary_labels} className="mt-0.5" />
                        <p className="min-w-0 flex-1 text-sm font-medium text-ink-900">{dish.name}</p>
                        <button
                          type="button"
                          onClick={() => remove(s.dish_id)}
                          className="-m-1 rounded-lg p-1 text-ink-400 hover:bg-burgundy-50 hover:text-burgundy-600"
                          aria-label={`Remove ${dish.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-end gap-3">
                        <Field
                          label={`Quantity (${QUANTITY_UNITS[dish.pricing_unit]})`}
                          id={`qty-${s.dish_id}`}
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="any"
                          value={s.quantity}
                          onChange={(e) => setQty(s.dish_id, e.target.value)}
                          error={qtyError}
                          className="w-36 [&_label]:text-xs"
                          inputClassName="py-2"
                        />
                        <p className="pb-2 text-right text-xs text-ink-500">
                          {formatCurrency(dish.price)} {PRICING_UNITS[dish.pricing_unit]}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-ivory-200 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink-700">Estimated menu total</span>
                <span className="text-xl font-semibold text-forest-800">{formatCurrency(total)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                An estimate at today's prices. Your quotation will include final pricing, service and taxes.
              </p>
            </div>
          </CardBody>
        </Card>
      </aside>

      <div className="lg:order-1">
        <div className="mb-6 space-y-4 rounded-2xl border border-ivory-200 bg-white/70 p-4">
          <Field
            label="Search dishes"
            name="menu-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            trailing={<Search className="mr-2.5 size-4 text-ink-400" aria-hidden="true" />}
          />
          <ChipGroup
            label="Course"
            options={menu.categoryList.filter((c) => menu.dishes.some((d) => d.category_id === c.id)).map((c) => [c.id, c.name])}
            value={category}
            onChange={setCategory}
          />
          <ChipGroup label="Diet" options={DIET_FILTERS} value={diet} onChange={setDiet} />
        </div>

        {sections.length === 0 ? (
          <EmptyState icon={Search} title="No dishes match" message="Try another search or filter." />
        ) : (
          <div className="space-y-10">
            {sections.map(({ category: cat, dishes }) => (
              <section key={cat.id} aria-labelledby={`pick-${cat.id}`}>
                <h2 id={`pick-${cat.id}`} className="text-2xl font-semibold text-forest-900">
                  {cat.name}
                </h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {dishes.map((dish) => {
                    const selected = selectedIds.has(dish.id)
                    return (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        selected={selected}
                        action={
                          selected ? (
                            <Button variant="secondary" size="sm" onClick={() => remove(dish.id)} aria-label={`Remove ${dish.name}`}>
                              <Check className="size-4" aria-hidden="true" />
                              Added
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => add(dish)} disabled={!dish.is_available} aria-label={`Add ${dish.name}`}>
                              <Plus className="size-4" aria-hidden="true" />
                              Add
                            </Button>
                          )
                        }
                      />
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
