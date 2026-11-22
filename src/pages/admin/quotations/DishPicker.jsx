import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import DietMark from '@/components/catalogue/DietMark.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Field from '@/components/ui/Field.jsx'
import { matchesSearch, priceLabel } from '@/utils/catalogue.js'

const LIMIT = 12

/** Search the catalogue and add dishes to the quotation. */
export default function DishPicker({ dishes, selectedIds, onAdd }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const term = query.trim()
    if (!term) return []
    return dishes
      .filter((d) => matchesSearch(d, term) || d.category?.name.toLowerCase().includes(term.toLowerCase()))
      .sort((a, b) => Number(b.is_available) - Number(a.is_available) || a.name.localeCompare(b.name))
  }, [dishes, query])

  return (
    <div className="space-y-2">
      <Field
        label="Add dishes from the menu"
        type="search"
        placeholder="Search by dish, ingredient or course"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        trailing={<Search className="mr-2.5 size-4 text-ink-400" aria-hidden="true" />}
        autoComplete="off"
      />
      {query.trim() && (
        <div className="rounded-xl border border-ivory-200 bg-white">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-500">No dishes match. Add it as a custom item instead.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-ivory-200 overflow-y-auto" aria-label="Matching dishes">
              {results.slice(0, LIMIT).map((dish) => {
                const added = selectedIds.has(dish.id)
                return (
                  <li key={dish.id}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => onAdd(dish)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-forest-50 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                    >
                      <DietMark labels={dish.dietary_labels} />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-ink-900">{dish.name}</span>
                        {!dish.is_available && <Badge className="ml-2">Unavailable</Badge>}
                        <span className="block truncate text-xs text-ink-400">
                          {dish.category?.name} · {dish.cuisine?.name}
                        </span>
                      </span>
                      <span className="hidden text-xs text-ink-500 sm:inline">{priceLabel(dish.price, dish.pricing_unit)}</span>
                      {added ? (
                        <Check className="size-4 text-forest-600" aria-label="Added" />
                      ) : (
                        <Plus className="size-4 text-forest-700" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                )
              })}
              {results.length > LIMIT && (
                <li className="px-4 py-2 text-xs text-ink-400">
                  {results.length - LIMIT} more – refine your search.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
