import { useEffect, useRef, useState } from 'react'
import { Check, ListPlus, Plus, RefreshCw, Sparkles } from 'lucide-react'
import DietMark from '@/components/catalogue/DietMark.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import { getMenuSuggestions } from '@/ai/menuSuggestions.js'
import { priceLabel } from '@/utils/catalogue.js'

/**
 * AI menu ideas for the Menu step. `state` lives in the wizard so results survive moving
 * between steps: { status: 'idle'|'loading'|'done'|'error', result?, error? }.
 */
export default function SuggestionsPanel({ draft, dishById, selectedIds, state, setState, onAdd, onAddMany }) {
  const abortRef = useRef(null)
  const [announce, setAnnounce] = useState('')
  useEffect(() => () => abortRef.current?.abort(), [])

  async function suggest() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'loading' })
    setAnnounce('Planning your menu…')
    try {
      const result = await getMenuSuggestions(draft, { signal: controller.signal })
      setState({ status: 'done', result })
      setAnnounce(`${result.dishes.length} dishes suggested.`)
    } catch (err) {
      if (err.name === 'AbortError') return
      setState({ status: 'error', error: err.message })
      setAnnounce('')
    }
  }

  // Only dishes that are still on the menu and available can be shown or added.
  const items = (state.result?.dishes ?? [])
    .map((s) => ({ ...s, dish: dishById.get(s.dish_id) }))
    .filter((s) => s.dish?.is_available)
  const notAdded = items.filter((s) => !selectedIds.has(s.dish_id))
  const loading = state.status === 'loading'

  return (
    <Card className="mb-6 border-gold-300/70 bg-gradient-to-br from-white to-ivory-100/70">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold-600" aria-hidden="true" />
            Need ideas? Let us suggest a menu
          </span>
        }
        description="Based on your event details and budget. Every suggestion comes from our current menu."
        action={
          <Button
            size="sm"
            variant={state.status === 'done' ? 'secondary' : 'primary'}
            onClick={suggest}
            loading={loading}
            className="shrink-0"
          >
            {!loading && (state.status === 'done' ? <RefreshCw className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />)}
            {loading ? 'Planning…' : state.status === 'done' ? 'Suggest again' : 'Suggest a menu'}
          </Button>
        }
      />

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {loading && (
        <CardBody>
          <p className="text-sm text-ink-500">Putting together a menu for your event. This can take up to half a minute…</p>
          <div className="mt-4 space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ivory-200/70" />
            ))}
          </div>
        </CardBody>
      )}

      {state.status === 'error' && (
        <CardBody>
          <Alert tone="error">{state.error}</Alert>
        </CardBody>
      )}

      {state.status === 'done' && (
        <CardBody className="space-y-4">
          {state.result.summary && <p className="text-sm leading-relaxed text-ink-700">{state.result.summary}</p>}
          {state.result.notes && <Alert tone="info">{state.result.notes}</Alert>}

          {items.length === 0 ? (
            <p className="text-sm text-ink-500">
              We couldn't find new dishes to suggest for these details. Try changing your preferences, or browse the menu below.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-ivory-200 rounded-xl border border-ivory-200 bg-white" aria-label="Suggested dishes">
                {items.map(({ dish, reason }) => {
                  const added = selectedIds.has(dish.id)
                  return (
                    <li key={dish.id} className="flex items-start gap-3 p-3">
                      <DietMark labels={dish.dietary_labels} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          {dish.name}
                          <span className="ml-2 text-xs font-normal text-ink-400">{dish.category?.name}</span>
                        </p>
                        {reason && <p className="mt-0.5 text-sm text-ink-500">{reason}</p>}
                        <p className="mt-1 text-xs text-ink-400">
                          {priceLabel(dish.price, dish.pricing_unit)}
                        </p>
                      </div>
                      {added ? (
                        <span className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-forest-700">
                          <Check className="size-4" aria-hidden="true" />
                          Added
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => onAdd(dish)} aria-label={`Add ${dish.name}`}>
                          <Plus className="size-4" aria-hidden="true" />
                          Add
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-400">
                  Suggestions are a starting point. Our team reviews every menu before quoting.
                </p>
                {notAdded.length > 0 && (
                  <Button size="sm" onClick={() => onAddMany(notAdded.map((s) => s.dish))}>
                    <ListPlus className="size-4" aria-hidden="true" />
                    Add {notAdded.length === items.length ? 'all' : 'remaining'} {notAdded.length}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardBody>
      )}
    </Card>
  )
}
