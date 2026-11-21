import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import ImagePicker from '@/components/catalogue/ImagePicker.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import ChipToggle from '@/components/ui/ChipToggle.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import Switch from '@/components/ui/Switch.jsx'
import { ALLERGENS, DIETARY_LABELS, EXCLUSIVE_DIETARY, PRICING_UNITS, TIERS } from '@/constants/catalogue.js'
import { useAsync } from '@/hooks/useAsync.js'
import { useForm } from '@/hooks/useForm.js'
import { categories, createDish, cuisines, getDish, updateDish } from '@/services/catalogueService.js'
import { removeDishImage, uploadDishImage, validateDishImage } from '@/services/dishImageService.js'
import { getErrorMessage } from '@/utils/errors.js'

const EMPTY = {
  name: '',
  description: '',
  category_id: '',
  cuisine_id: '',
  price: '',
  pricing_unit: 'per_person',
  tier: 'standard',
  dietary_labels: [],
  allergens: [],
  is_available: true,
}

const toFormValues = (dish) => ({
  name: dish.name,
  description: dish.description ?? '',
  category_id: dish.category_id,
  cuisine_id: dish.cuisine_id,
  price: dish.price === null ? '' : String(dish.price),
  pricing_unit: dish.pricing_unit,
  tier: dish.tier,
  dietary_labels: dish.dietary_labels,
  allergens: dish.allergens,
  is_available: dish.is_available,
})

function validate(v) {
  const price = Number(v.price)
  return {
    name: !v.name.trim() ? 'Dish name is required.' : v.name.trim().length > 120 ? 'Keep the name under 120 characters.' : undefined,
    description: v.description.length > 1000 ? 'Keep the description under 1000 characters.' : undefined,
    category_id: v.category_id ? undefined : 'Choose a category.',
    cuisine_id: v.cuisine_id ? undefined : 'Choose a cuisine.',
    price:
      v.price.trim() === ''
        ? undefined // no price yet: shown to customers as "Price on request"
        : !Number.isFinite(price) || price < 0
          ? 'Enter a price of 0 or more.'
          : price >= 1e8
            ? 'That price is too large.'
            : !/^\d+(\.\d{1,2})?$/.test(v.price.trim())
              ? 'Use at most two decimal places.'
              : undefined,
  }
}

/** Load everything the form needs in one go. */
async function loadForm(id) {
  const [categoryList, cuisineList, dish] = await Promise.all([
    categories.list(),
    cuisines.list(),
    id ? getDish(id) : Promise.resolve(null),
  ])
  return { categoryList, cuisineList, dish }
}

export default function DishFormPage() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync(() => loadForm(id), [id])

  if (loading) return <PageLoader label="Loading…" />
  if (error) {
    const missing = error.code === 'PGRST116'
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title={missing ? 'Dish not found' : "Couldn't load this page"}
        message={missing ? 'It may have been deleted.' : getErrorMessage(error)}
        actions={
          <>
            {!missing && <Button onClick={reload}>Try again</Button>}
            <Button to="/admin/dishes" variant="secondary">
              Back to dishes
            </Button>
          </>
        }
      />
    )
  }
  // Remount the form when switching between dishes so state never leaks across.
  return <DishForm key={id ?? 'new'} {...data} />
}

function DishForm({ categoryList, cuisineList, dish }) {
  const navigate = useNavigate()
  const isEdit = Boolean(dish)
  const { values, errors, setErrors, setValue, handleChange, handleSubmit } = useForm(
    dish ? toFormValues(dish) : EMPTY,
    validate,
  )
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const noGroups = categoryList.length === 0 || cuisineList.length === 0

  function toggleList(field, key, on) {
    setValue(field, (list) => {
      let next = on ? [...list, key] : list.filter((k) => k !== key)
      if (on) {
        for (const group of EXCLUSIVE_DIETARY) {
          if (group.includes(key)) next = next.filter((k) => k === key || !group.includes(k))
        }
      }
      return next
    })
  }

  const onSubmit = handleSubmit(async (v) => {
    if (imageError) return
    setSaving(true)
    setFailure(null)
    let uploadedPath = null
    try {
      if (imageFile) uploadedPath = await uploadDishImage(imageFile)
      const previousPath = dish?.image_path ?? null
      const image_path = uploadedPath ?? (imageRemoved ? null : previousPath)
      const payload = {
        ...v,
        name: v.name.trim(),
        description: v.description.trim() || null,
        price: v.price.trim() === '' ? null : Number(v.price),
        image_path,
      }
      const saved = isEdit ? await updateDish(dish.id, payload) : await createDish(payload)
      if (previousPath && previousPath !== image_path) await removeDishImage(previousPath)
      toast.success(isEdit ? `${saved.name} was updated.` : `${saved.name} was added to the menu.`)
      navigate('/admin/dishes')
    } catch (err) {
      if (uploadedPath) await removeDishImage(uploadedPath)
      if (err.code === '23505') {
        setErrors((prev) => ({ ...prev, name: 'A dish with this name already exists in this category.' }))
      } else if (err.code === '23503') {
        setFailure('The selected category or cuisine no longer exists. Reload the page and choose again.')
      } else {
        setFailure(getErrorMessage(err))
      }
      setSaving(false)
    }
  })

  const groupOption = (g) => (
    <option key={g.id} value={g.id}>
      {g.name}
      {g.is_active ? '' : ' (hidden from customers)'}
    </option>
  )

  return (
    <>
      <Button to="/admin/dishes" variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All dishes
      </Button>
      <PageHeader eyebrow="Catalogue" title={isEdit ? `Edit ${dish.name}` : 'Add a dish'} />

      {noGroups && (
        <Alert tone="warning" className="mb-6" title="Set up categories and cuisines first">
          Every dish needs a category and a cuisine.{' '}
          <Button to="/admin/catalogue" variant="ghost" size="sm" className="-my-1 ml-1 px-2 underline">
            Manage categories & cuisines
          </Button>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {failure && <Alert tone="error">{failure}</Alert>}

          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-5">
              <Field label="Dish name" name="name" value={values.name} onChange={handleChange} error={errors.name} maxLength={120} />
              <Field
                label="Description"
                name="description"
                as="textarea"
                optional
                value={values.description}
                onChange={handleChange}
                error={errors.description}
                hint={`${values.description.length}/1000 – shown to customers on the menu.`}
                maxLength={1000}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Category" name="category_id" as="select" value={values.category_id} onChange={handleChange} error={errors.category_id}>
                  <option value="">Choose…</option>
                  {categoryList.map(groupOption)}
                </Field>
                <Field label="Cuisine" name="cuisine_id" as="select" value={values.cuisine_id} onChange={handleChange} error={errors.cuisine_id}>
                  <option value="">Choose…</option>
                  {cuisineList.map(groupOption)}
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pricing"
              description="Customers see this price; quotations take a snapshot of it. Leave the price blank to show “Price on request”."
            />
            <CardBody className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Price (₹)"
                name="price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.price}
                onChange={handleChange}
                error={errors.price}
              />
              <Field label="Unit" name="pricing_unit" as="select" value={values.pricing_unit} onChange={handleChange}>
                {Object.entries(PRICING_UNITS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Field>
              <Field label="Tier" name="tier" as="select" value={values.tier} onChange={handleChange}>
                {Object.entries(TIERS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dietary information" description="Vegetarian and non-vegetarian can't both be selected." />
            <CardBody className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink-700">Dietary labels</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DIETARY_LABELS).map(([key, label]) => (
                    <ChipToggle key={key} checked={values.dietary_labels.includes(key)} onChange={(on) => toggleList('dietary_labels', key, on)}>
                      {label}
                    </ChipToggle>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink-700">Contains allergens</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ALLERGENS).map(([key, label]) => (
                    <ChipToggle key={key} checked={values.allergens.includes(key)} onChange={(on) => toggleList('allergens', key, on)}>
                      {label}
                    </ChipToggle>
                  ))}
                </div>
              </fieldset>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardBody className="space-y-5">
              <ImagePicker
                file={imageFile}
                existingPath={dish?.image_path}
                removed={imageRemoved}
                error={imageError}
                disabled={saving}
                onSelect={(file) => {
                  setImageError(validateDishImage(file) ?? null)
                  setImageFile(file)
                  setImageRemoved(false)
                }}
                onRemove={() => {
                  setImageFile(null)
                  setImageError(null)
                  setImageRemoved(true)
                }}
              />
              <div className="border-t border-ivory-200 pt-5">
                <Switch
                  checked={values.is_available}
                  onChange={(on) => setValue('is_available', on)}
                  label="Available to order"
                  showLabel
                />
                <p className="mt-1.5 text-xs text-ink-400">Unavailable dishes stay on the menu, marked as unavailable.</p>
              </div>
              <div className="flex flex-col gap-3 border-t border-ivory-200 pt-5">
                <Button type="submit" loading={saving} disabled={noGroups}>
                  {isEdit ? 'Save changes' : 'Add dish'}
                </Button>
                <Button to="/admin/dishes" variant="secondary" disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </form>
    </>
  )
}
