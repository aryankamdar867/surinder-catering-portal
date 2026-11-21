import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2, TriangleAlert, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import DietMark from '@/components/catalogue/DietMark.jsx'
import DishImage from '@/components/catalogue/DishImage.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import Switch from '@/components/ui/Switch.jsx'
import { PRICING_UNITS } from '@/constants/catalogue.js'
import { useAsync } from '@/hooks/useAsync.js'
import { deleteDish, listDishes, updateDish } from '@/services/catalogueService.js'
import { removeDishImage } from '@/services/dishImageService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency } from '@/utils/format.js'
import { matchesDiet, uniqueOptions } from '@/utils/catalogue.js'

const initialFilters = { q: '', category: '', cuisine: '', diet: '', availability: '' }

export default function DishesPage() {
  const { data: dishes, error, loading, reload, setData } = useAsync(listDishes)
  const [filters, setFilters] = useState(initialFilters)
  const [pendingId, setPendingId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const categoryOptions = useMemo(() => uniqueOptions(dishes, 'category'), [dishes])
  const cuisineOptions = useMemo(() => uniqueOptions(dishes, 'cuisine'), [dishes])

  const visible = useMemo(() => {
    if (!dishes) return []
    const q = filters.q.trim().toLowerCase()
    return dishes.filter(
      (d) =>
        (!q || d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)) &&
        (!filters.category || d.category_id === filters.category) &&
        (!filters.cuisine || d.cuisine_id === filters.cuisine) &&
        matchesDiet(d, filters.diet) &&
        (!filters.availability || String(d.is_available) === filters.availability),
    )
  }, [dishes, filters])

  const onFilter = (event) => setFilters((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  const filtered = Object.values(filters).some(Boolean)

  async function toggleAvailability(dish) {
    setPendingId(dish.id)
    try {
      const saved = await updateDish(dish.id, { is_available: !dish.is_available })
      setData((list) => list.map((d) => (d.id === saved.id ? saved : d)))
      toast.success(`${saved.name} is now ${saved.is_available ? 'available' : 'unavailable'}.`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPendingId(null)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteDish(toDelete.id)
      await removeDishImage(toDelete.image_path)
      setData((list) => list.filter((d) => d.id !== toDelete.id))
      toast.success(`${toDelete.name} was deleted.`)
      setToDelete(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !dishes) return <PageLoader label="Loading dishes…" />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load dishes"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  const available = dishes.filter((d) => d.is_available).length

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Dishes"
        description={`${dishes.length} ${dishes.length === 1 ? 'dish' : 'dishes'} · ${available} available to customers`}
        actions={
          <Button to="/admin/dishes/new">
            <Plus className="size-4" aria-hidden="true" />
            Add dish
          </Button>
        }
      />

      {dishes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No dishes yet"
          message="Add your first dish. You'll need at least one category and cuisine, which you can manage under Categories & cuisines."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button to="/admin/dishes/new">Add dish</Button>
              <Button to="/admin/catalogue" variant="secondary">
                Categories & cuisines
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <Field
              label="Search"
              name="q"
              type="search"
              placeholder="Dish name or description"
              value={filters.q}
              onChange={onFilter}
              trailing={<Search className="mr-2.5 size-4 text-ink-400" aria-hidden="true" />}
            />
            <Field label="Category" name="category" as="select" value={filters.category} onChange={onFilter}>
              <option value="">All</option>
              {categoryOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Field>
            <Field label="Cuisine" name="cuisine" as="select" value={filters.cuisine} onChange={onFilter}>
              <option value="">All</option>
              {cuisineOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Field>
            <Field label="Diet" name="diet" as="select" value={filters.diet} onChange={onFilter}>
              <option value="">All</option>
              <option value="veg">Vegetarian</option>
              <option value="nonveg">Non-veg / egg</option>
            </Field>
            <Field label="Status" name="availability" as="select" value={filters.availability} onChange={onFilter}>
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </Field>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching dishes"
              message="Try a different search or clear the filters."
              action={
                filtered && (
                  <Button variant="secondary" onClick={() => setFilters(initialFilters)}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-ivory-200" aria-label="Dishes">
                {visible.map((dish) => (
                  <li key={dish.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <DishImage path={dish.image_path} className="size-16 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <DietMark labels={dish.dietary_labels} />
                          <Link
                            to={`/admin/dishes/${dish.id}`}
                            className="truncate font-semibold text-ink-900 hover:text-forest-700"
                          >
                            {dish.name}
                          </Link>
                          {dish.tier === 'premium' && <Badge tone="gold">Premium</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-ink-500">
                          {dish.category?.name ?? '—'} · {dish.cuisine?.name ?? '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <p className="text-sm sm:w-36 sm:text-right">
                        <span className="font-semibold text-ink-900">{formatCurrency(dish.price)}</span>{' '}
                        <span className="text-ink-400">{PRICING_UNITS[dish.pricing_unit]}</span>
                      </p>
                      <Switch
                        checked={dish.is_available}
                        disabled={pendingId === dish.id}
                        onChange={() => toggleAvailability(dish)}
                        label={`${dish.name} available`}
                      />
                      <div className="flex gap-1">
                        <Button
                          to={`/admin/dishes/${dish.id}`}
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${dish.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setToDelete(dish)}
                          aria-label={`Delete ${dish.name}`}
                          className="text-burgundy-600 hover:bg-burgundy-50"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.name ?? 'dish'}?`}
        message={
          <>
            <p>The dish and its photo will be removed from the menu permanently.</p>
            <Alert tone="info" className="mt-3">
              Past enquiries and quotations keep their own copy of the dish name and price. To hide a dish
              temporarily, switch it to unavailable instead.
            </Alert>
          </>
        }
        confirmLabel="Delete dish"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
