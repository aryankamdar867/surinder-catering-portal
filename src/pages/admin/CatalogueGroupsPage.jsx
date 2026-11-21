import { useState } from 'react'
import { Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import Switch from '@/components/ui/Switch.jsx'
import { useAsync } from '@/hooks/useAsync.js'
import { useForm } from '@/hooks/useForm.js'
import { categories, countDishesBy, cuisines } from '@/services/catalogueService.js'
import { getErrorMessage } from '@/utils/errors.js'

const GROUPS = [
  { key: 'categories', api: categories, column: 'category_id', singular: 'category', title: 'Categories', hint: 'Courses or sections of the menu, e.g. Starters, Desserts.' },
  { key: 'cuisines', api: cuisines, column: 'cuisine_id', singular: 'cuisine', title: 'Cuisines', hint: 'Regional styles, e.g. North Indian, Continental.' },
]

async function loadAll() {
  const [categoryList, cuisineList, byCategory, byCuisine] = await Promise.all([
    categories.list(),
    cuisines.list(),
    countDishesBy('category_id'),
    countDishesBy('cuisine_id'),
  ])
  return {
    categories: { items: categoryList, counts: byCategory },
    cuisines: { items: cuisineList, counts: byCuisine },
  }
}

const validateGroup = (v) => ({
  name: !v.name.trim() ? 'Name is required.' : v.name.trim().length > 80 ? 'Keep it under 80 characters.' : undefined,
  description: v.description.length > 500 ? 'Keep it under 500 characters.' : undefined,
  sort_order: /^-?\d{1,6}$/.test(String(v.sort_order).trim()) ? undefined : 'Use a whole number.',
})

const toPayload = (v) => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  sort_order: Number(v.sort_order),
})

const friendly = (err, singular) =>
  err.code === '23505' ? `A ${singular} with this name already exists.` : getErrorMessage(err)

export default function CatalogueGroupsPage() {
  const { data, error, loading, reload, setData } = useAsync(loadAll)

  if (loading && !data) return <PageLoader />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load the catalogue"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Categories & cuisines"
        description="Hidden entries stay attached to their dishes but are not shown to customers."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {GROUPS.map((group) => (
          <GroupCard
            key={group.key}
            group={group}
            items={data[group.key].items}
            counts={data[group.key].counts}
            onChange={(items) => setData((prev) => ({ ...prev, [group.key]: { ...prev[group.key], items } }))}
          />
        ))}
      </div>
    </>
  )
}

function GroupCard({ group, items, counts, onChange }) {
  const [editingId, setEditingId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const nextSort = items.reduce((max, i) => Math.max(max, i.sort_order), 0) + 10
  const sorted = (list) => [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  async function toggleActive(item) {
    setTogglingId(item.id)
    try {
      const saved = await group.api.update(item.id, { is_active: !item.is_active })
      onChange(items.map((i) => (i.id === saved.id ? saved : i)))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await group.api.remove(toDelete.id)
      onChange(items.filter((i) => i.id !== toDelete.id))
      toast.success(`${toDelete.name} was deleted.`)
      setToDelete(null)
    } catch (err) {
      toast.error(
        err.code === '23503'
          ? `${toDelete.name} is still used by dishes. Move those dishes or hide it instead.`
          : getErrorMessage(err),
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader title={group.title} description={group.hint} />
      <CardBody className="space-y-4">
        <GroupForm
          key={`add-${items.length}`}
          initial={{ name: '', description: '', sort_order: String(nextSort) }}
          submitLabel={`Add ${group.singular}`}
          idPrefix={`${group.key}-new`}
          onSave={async (values) => {
            const saved = await group.api.create(toPayload(values))
            onChange(sorted([...items, saved]))
            toast.success(`${saved.name} was added.`)
          }}
          singular={group.singular}
        />

        {items.length === 0 ? (
          <p className="rounded-xl bg-ivory-100 px-4 py-6 text-center text-sm text-ink-500">
            No {group.title.toLowerCase()} yet.
          </p>
        ) : (
          <ul className="divide-y divide-ivory-200 rounded-xl border border-ivory-200 bg-white" aria-label={group.title}>
            {items.map((item) => {
              const used = counts[item.id] ?? 0
              if (editingId === item.id) {
                return (
                  <li key={item.id} className="p-4">
                    <GroupForm
                      initial={{ name: item.name, description: item.description ?? '', sort_order: String(item.sort_order) }}
                      submitLabel="Save"
                      idPrefix={`${group.key}-${item.id}`}
                      singular={group.singular}
                      onCancel={() => setEditingId(null)}
                      onSave={async (values) => {
                        const saved = await group.api.update(item.id, toPayload(values))
                        onChange(sorted(items.map((i) => (i.id === saved.id ? saved : i))))
                        setEditingId(null)
                        toast.success(`${saved.name} was updated.`)
                      }}
                    />
                  </li>
                )
              }
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">{item.name}</span>
                      {!item.is_active && <Badge>Hidden</Badge>}
                    </div>
                    <p className="truncate text-xs text-ink-400">
                      {used} {used === 1 ? 'dish' : 'dishes'} · order {item.sort_order}
                      {item.description ? ` · ${item.description}` : ''}
                    </p>
                  </div>
                  <Switch
                    checked={item.is_active}
                    disabled={togglingId === item.id}
                    onChange={() => toggleActive(item)}
                    label={`Show ${item.name} to customers`}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(item.id)} aria-label={`Edit ${item.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={used > 0}
                    title={used > 0 ? `Used by ${used} ${used === 1 ? 'dish' : 'dishes'} – hide it instead` : undefined}
                    onClick={() => setToDelete(item)}
                    aria-label={used > 0 ? `${item.name} is in use and can't be deleted` : `Delete ${item.name}`}
                    className="text-burgundy-600 hover:bg-burgundy-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.name ?? group.singular}?`}
        message={`This ${group.singular} isn't used by any dish. Deleting it can't be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  )
}

function GroupForm({ initial, submitLabel, idPrefix, singular, onSave, onCancel }) {
  const { values, errors, setErrors, handleChange, handleSubmit } = useForm(initial, validateGroup)
  const [saving, setSaving] = useState(false)

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true)
    try {
      // The add form remounts with fresh values (its key changes); the edit form closes.
      await onSave(v)
    } catch (err) {
      setErrors((prev) => ({ ...prev, name: friendly(err, singular) }))
    } finally {
      setSaving(false)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
      <Field label="Name" id={`${idPrefix}-name`} name="name" value={values.name} onChange={handleChange} error={errors.name} maxLength={80} />
      <Field
        label="Order"
        id={`${idPrefix}-sort`}
        name="sort_order"
        type="number"
        step="1"
        value={values.sort_order}
        onChange={handleChange}
        error={errors.sort_order}
      />
      <Field
        label="Description"
        id={`${idPrefix}-description`}
        name="description"
        optional
        value={values.description}
        onChange={handleChange}
        error={errors.description}
        maxLength={500}
        className="sm:col-span-2"
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={saving}>
          {!onCancel && <Plus className="size-4" aria-hidden="true" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
