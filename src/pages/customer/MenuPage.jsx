import { useMemo, useState } from 'react'
import { CalendarPlus, Search, TriangleAlert, UtensilsCrossed } from 'lucide-react'
import DishCard from '@/components/catalogue/DishCard.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import ChipGroup from '@/components/ui/FilterChips.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { useAsync } from '@/hooks/useAsync.js'
import { listMenu } from '@/services/catalogueService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { DIET_FILTERS, TIER_FILTERS, groupByCategory, matchesDiet, matchesSearch, uniqueOptions } from '@/utils/catalogue.js'

export default function MenuPage() {
  const { data, error, loading, reload } = useAsync(listMenu)
  const [q, setQ] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [diet, setDiet] = useState('')
  const [tier, setTier] = useState('')

  const cuisineOptions = useMemo(() => uniqueOptions(data?.dishes, 'cuisine').map((c) => [c.id, c.name]), [data])

  const sections = useMemo(() => {
    if (!data) return []
    const matches = data.dishes.filter(
      (d) => matchesSearch(d, q) && (!cuisine || d.cuisine_id === cuisine) && (!tier || d.tier === tier) && matchesDiet(d, diet),
    )
    return groupByCategory(data.categoryList, matches)
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
        description="Explore what we cook. Pick your favourites when you plan an event with us."
        actions={
          <Button to="/account/enquiries/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Plan an event
          </Button>
        }
      />

      {data.dishes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Our menu is being prepared"
          message="Dishes will appear here soon. You can still send us an enquiry and we'll suggest a menu."
          action={<Button to="/account/enquiries/new">Plan an event</Button>}
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
