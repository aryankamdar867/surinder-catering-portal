import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, PenLine, Plus, Save, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { QuotationTotals } from '@/components/quotation/QuotationDocument.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import { FilterChip } from '@/components/ui/FilterChips.jsx'
import { PRICING_UNITS } from '@/constants/catalogue.js'
import { defaultQuantity } from '@/constants/enquiry.js'
import { DISCOUNT_TYPES, GST_PRESETS, PRICING_MODES } from '@/constants/quotation.js'
import { discardDraft, saveQuotationDraft, sendQuotation } from '@/services/quotationService.js'
import { hasPrice } from '@/utils/catalogue.js'
import { cn } from '@/utils/cn.js'
import { formatEventDate, todayInIndia } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency } from '@/utils/format.js'
import { computeTotals, lineTotal } from '@/utils/quotation.js'
import DishPicker from './DishPicker.jsx'

const newKey = () => crypto.randomUUID()
const str = (n) => (n === null || n === undefined ? '' : String(Number(n)))

function toForm(v) {
  return {
    pricing_mode: v.pricing_mode,
    guest_count: String(v.guest_count),
    per_person_rate: str(v.per_person_rate),
    additional_charges: v.additional_charges.map((c) => ({ key: newKey(), label: c.label, amount: str(c.amount) })),
    discount_type: v.discount_type,
    discount_value: v.discount_type === 'none' ? '' : str(v.discount_value),
    gst_rate: str(v.gst_rate),
    advance_amount: Number(v.advance_amount) ? str(v.advance_amount) : '',
    valid_until: v.valid_until ?? '',
    terms: v.terms ?? '',
    notes_to_customer: v.notes_to_customer ?? '',
    items: v.items.map((i) => ({
      key: i.id,
      dish_id: i.dish_id,
      dish_name: i.dish_name,
      description: i.description ?? '',
      category_name: i.category_name ?? '',
      cuisine_name: i.cuisine_name ?? '',
      unit_price: str(i.unit_price),
      pricing_unit: i.pricing_unit,
      quantity: str(i.quantity),
    })),
  }
}

/** Form state without the React keys, for change detection. */
const snapshot = (form) =>
  JSON.stringify({
    ...form,
    items: form.items.map(({ key: _key, ...rest }) => rest),
    additional_charges: form.additional_charges.map(({ key: _key, ...rest }) => rest),
  })

const blank = (v) => String(v ?? '').trim() === ''
const badAmount = (v) => !blank(v) && !(Number.isFinite(Number(v)) && Number(v) >= 0)

/** Client-side checks that mirror save_quotation_draft() / send_quotation(). */
function validate(form, { forSend }) {
  const errors = {}
  const guests = Number(form.guest_count)
  if (!/^\d+$/.test(form.guest_count.trim()) || guests < 1 || guests > 100000) {
    errors.guest_count = 'Enter a whole number between 1 and 100,000.'
  }
  if (form.pricing_mode === 'per_person' && blank(form.per_person_rate)) errors.per_person_rate = 'Enter the per-person rate.'
  for (const field of ['per_person_rate', 'discount_value', 'gst_rate', 'advance_amount']) {
    if (badAmount(form[field])) errors[field] = 'Enter a valid amount.'
  }
  if (form.discount_type !== 'none' && blank(form.discount_value)) errors.discount_value = 'Enter the discount.'
  if (form.discount_type === 'percent' && Number(form.discount_value) > 100) errors.discount_value = "Can't be more than 100%."
  if (Number(form.gst_rate) > 28) errors.gst_rate = 'GST must be between 0% and 28%.'

  for (const c of form.additional_charges) {
    if (blank(c.label)) errors[`charge:${c.key}`] = 'Name this charge.'
    else if (blank(c.amount) || badAmount(c.amount)) errors[`charge:${c.key}`] = 'Enter an amount.'
  }

  for (const item of form.items) {
    const qty = Number(item.quantity)
    if (blank(item.dish_name)) errors[`item:${item.key}`] = 'Enter a name.'
    else if (blank(item.quantity) || !(qty > 0 && qty <= 100000)) errors[`item:${item.key}`] = 'Quantity must be between 0.01 and 100,000.'
    else if (badAmount(item.unit_price)) errors[`item:${item.key}`] = 'Enter a valid price.'
    else if (forSend && form.pricing_mode === 'itemised' && blank(item.unit_price)) errors[`item:${item.key}`] = 'Set a price before sending.'
  }

  if (forSend) {
    if (form.items.length === 0) errors.items = 'Add at least one item before sending.'
    if (blank(form.valid_until) || form.valid_until < todayInIndia()) errors.valid_until = 'Choose a date from today onwards.'
    if (Object.keys(errors).length === 0) {
      const t = computeTotals(form)
      if (t.discount_amount > t.gross) errors.discount_value = "The discount can't be more than the subtotal plus charges."
      if (t.advance_amount > t.total_amount) errors.advance_amount = "The advance can't be more than the total."
    }
  }
  return errors
}

const inputClass = (error) =>
  cn(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-4',
    error ? 'border-burgundy-500 focus:ring-burgundy-500/10' : 'border-ivory-300 focus:border-forest-600 focus:ring-forest-600/10',
  )

function ItemRow({ item, index, count, perPerson, error, onChange, onRemove, onMove }) {
  const total = lineTotal(item)
  const custom = !item.dish_id
  return (
    <li className="py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_6.5rem_auto] sm:items-center">
        <div className="col-span-2 sm:col-span-1">
          <input
            aria-label={`Item ${index + 1} name`}
            className={inputClass(error && blank(item.dish_name))}
            value={item.dish_name}
            maxLength={120}
            placeholder="Item name"
            onChange={(e) => onChange({ dish_name: e.target.value })}
          />
          <p className="mt-1 truncate text-xs text-ink-400">
            {custom ? (
              <span className="inline-flex items-center gap-1">
                <PenLine className="size-3" aria-hidden="true" />
                Custom item
              </span>
            ) : (
              [item.category_name, item.cuisine_name].filter(Boolean).join(' · ')
            )}
          </p>
        </div>
        <input
          aria-label={`Item ${index + 1} quantity`}
          inputMode="decimal"
          className={inputClass(error && /Quantity/.test(error))}
          value={item.quantity}
          placeholder="Qty"
          onChange={(e) => onChange({ quantity: e.target.value })}
        />
        <select
          aria-label={`Item ${index + 1} pricing unit`}
          className={inputClass(false)}
          value={item.pricing_unit}
          onChange={(e) => onChange({ pricing_unit: e.target.value })}
        >
          {Object.entries(PRICING_UNITS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label={`Item ${index + 1} price in rupees`}
          inputMode="decimal"
          className={inputClass(error && /price/i.test(error))}
          value={item.unit_price}
          placeholder={perPerson ? 'Optional' : '₹ Price'}
          onChange={(e) => onChange({ unit_price: e.target.value })}
        />
        <p className="self-center text-right text-sm font-semibold text-ink-900">
          {total === null ? <span className="font-normal text-ink-400">—</span> : formatCurrency(total)}
        </p>
        <div className="col-span-2 flex justify-end sm:col-span-1">
          <Button variant="ghost" size="sm" className="px-2" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${item.dish_name || 'item'} up`}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${item.dish_name || 'item'} down`}>
            <ArrowDown className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2 text-burgundy-600 hover:bg-burgundy-50" onClick={onRemove} aria-label={`Remove ${item.dish_name || 'item'}`}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {custom && (
        <input
          aria-label={`Item ${index + 1} section`}
          className={cn(inputClass(false), 'mt-2 sm:max-w-xs')}
          value={item.category_name}
          maxLength={80}
          placeholder="Section on the quotation, e.g. Live counters"
          onChange={(e) => onChange({ category_name: e.target.value })}
        />
      )}
      {error && <p className="mt-1 text-xs font-medium text-burgundy-600">{error}</p>}
    </li>
  )
}

/**
 * Edits the quotation's draft version. Saving replaces the draft's settings and items
 * in one database call; the parent remounts this component with the saved version.
 */
export default function QuotationEditor({ quotation, version, dishes, onSaved, onSent, onDiscarded }) {
  const initial = useMemo(() => toForm(version), [version])
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(null) // 'save' | 'send' | 'discard'
  const [confirm, setConfirm] = useState(null) // 'send' | 'discard'

  const dirty = snapshot(form) !== snapshot(initial)
  const totals = computeTotals(form)
  const perPerson = form.pricing_mode === 'per_person'
  const selectedIds = useMemo(() => new Set(form.items.map((i) => i.dish_id).filter(Boolean)), [form.items])
  const missingPrices = !perPerson && form.items.some((i) => blank(i.unit_price))

  useEffect(() => {
    if (!dirty) return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))
  const updateItem = (key, patch) => setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }))
  const removeItem = (key) => setForm((f) => ({ ...f, items: f.items.filter((i) => i.key !== key) }))
  const moveItem = (index, dir) =>
    setForm((f) => {
      const items = [...f.items]
      ;[items[index], items[index + dir]] = [items[index + dir], items[index]]
      return { ...f, items }
    })

  function addDish(dish) {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          key: newKey(),
          dish_id: dish.id,
          dish_name: dish.name,
          description: '',
          category_name: dish.category?.name ?? '',
          cuisine_name: dish.cuisine?.name ?? '',
          unit_price: hasPrice(dish.price) ? str(dish.price) : '',
          pricing_unit: dish.pricing_unit,
          quantity: String(defaultQuantity(dish.pricing_unit, f.guest_count)),
        },
      ],
    }))
  }

  function addCustomItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          key: newKey(),
          dish_id: null,
          dish_name: '',
          description: '',
          category_name: '',
          cuisine_name: '',
          unit_price: '',
          pricing_unit: 'per_person',
          quantity: String(defaultQuantity('per_person', f.guest_count)),
        },
      ],
    }))
  }

  const updateCharge = (key, patch) =>
    setForm((f) => ({ ...f, additional_charges: f.additional_charges.map((c) => (c.key === key ? { ...c, ...patch } : c)) }))

  function check(forSend) {
    const found = validate(form, { forSend })
    setErrors(found)
    const first = Object.values(found)[0]
    if (first) toast.error(Object.keys(found).length > 1 ? `${first} (and ${Object.keys(found).length - 1} more)` : first)
    return !first
  }

  async function save() {
    if (!check(false)) return
    setBusy('save')
    try {
      await saveQuotationDraft(quotation.id, form)
      toast.success('Draft saved.')
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setBusy(null)
    }
  }

  async function send() {
    setBusy('send')
    try {
      if (dirty) await saveQuotationDraft(quotation.id, form)
      await sendQuotation(quotation.id)
      toast.success(`${quotation.quotation_number} was sent to ${quotation.enquiry.contact_name}.`)
      onSent()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirm(null)
      setBusy(null)
      // A save may have succeeded before the send failed; show what is stored.
      if (dirty) onSaved()
    }
  }

  async function discard() {
    setBusy('discard')
    try {
      const deleted = await discardDraft(quotation.id)
      toast.success(deleted ? 'Quotation deleted.' : 'Draft revision discarded.')
      onDiscarded(deleted)
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirm(null)
      setBusy(null)
    }
  }

  const today = todayInIndia()
  const revision = version.version_number > 1

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Pricing" />
          <CardBody className="space-y-5">
            <div role="radiogroup" aria-label="Pricing" className="grid gap-3 sm:grid-cols-2">
              {Object.entries(PRICING_MODES).map(([value, { label, hint }]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-forest-600/10',
                    form.pricing_mode === value ? 'border-forest-600 bg-forest-50' : 'border-ivory-300 bg-white hover:border-forest-600',
                  )}
                >
                  <input
                    type="radio"
                    name="pricing_mode"
                    value={value}
                    checked={form.pricing_mode === value}
                    onChange={set('pricing_mode')}
                    className="mt-1 accent-forest-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{label}</span>
                    <span className="block text-xs text-ink-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Guests" inputMode="numeric" value={form.guest_count} onChange={set('guest_count')} error={errors.guest_count} />
              {perPerson && (
                <Field
                  label="Rate per person (₹)"
                  inputMode="decimal"
                  value={form.per_person_rate}
                  onChange={set('per_person_rate')}
                  error={errors.per_person_rate}
                />
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Menu"
            description={perPerson ? 'Listed for the customer; item prices are optional with per-person pricing.' : 'Quantities and prices are per item.'}
          />
          <CardBody className="space-y-4">
            {form.items.length > 0 ? (
              <>
                <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_6.5rem_7.5rem] gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 sm:grid">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Price (₹)</span>
                  <span className="text-right">Line total</span>
                  <span />
                </div>
                <ul className="divide-y divide-ivory-200 border-y border-ivory-200">
                  {form.items.map((item, index) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      index={index}
                      count={form.items.length}
                      perPerson={perPerson}
                      error={errors[`item:${item.key}`]}
                      onChange={(patch) => updateItem(item.key, patch)}
                      onRemove={() => removeItem(item.key)}
                      onMove={(dir) => moveItem(index, dir)}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className={cn('rounded-xl border border-dashed px-4 py-6 text-center text-sm', errors.items ? 'border-burgundy-500 text-burgundy-600' : 'border-ivory-300 text-ink-500')}>
                {errors.items ?? 'No items yet. Search the menu below or add a custom item.'}
              </p>
            )}
            <DishPicker dishes={dishes} selectedIds={selectedIds} onAdd={addDish} />
            <Button variant="secondary" size="sm" onClick={addCustomItem}>
              <Plus className="size-4" aria-hidden="true" />
              Add custom item
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Charges, discount & tax" />
          <CardBody className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink-700">Additional charges</p>
              {form.additional_charges.length === 0 && (
                <p className="text-sm text-ink-400">None. Add service staff, transport, décor or similar.</p>
              )}
              {form.additional_charges.map((c, i) => (
                <div key={c.key}>
                  <div className="flex gap-2">
                    <input
                      aria-label={`Charge ${i + 1} name`}
                      className={inputClass(errors[`charge:${c.key}`] && blank(c.label))}
                      value={c.label}
                      maxLength={120}
                      placeholder="e.g. Service staff"
                      onChange={(e) => updateCharge(c.key, { label: e.target.value })}
                    />
                    <input
                      aria-label={`Charge ${i + 1} amount in rupees`}
                      inputMode="decimal"
                      className={cn(inputClass(errors[`charge:${c.key}`] && !blank(c.label)), 'w-36 shrink-0')}
                      value={c.amount}
                      placeholder="₹ Amount"
                      onChange={(e) => updateCharge(c.key, { amount: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto shrink-0 px-2 text-burgundy-600 hover:bg-burgundy-50"
                      onClick={() => setForm((f) => ({ ...f, additional_charges: f.additional_charges.filter((x) => x.key !== c.key) }))}
                      aria-label={`Remove ${c.label || 'charge'}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {errors[`charge:${c.key}`] && <p className="mt-1 text-xs font-medium text-burgundy-600">{errors[`charge:${c.key}`]}</p>}
                </div>
              ))}
              {form.additional_charges.length < 20 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, additional_charges: [...f.additional_charges, { key: newKey(), label: '', amount: '' }] }))}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add charge
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Discount"
                as="select"
                value={form.discount_type}
                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value, discount_value: e.target.value === 'none' ? '' : f.discount_value }))}
              >
                {Object.entries(DISCOUNT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Field>
              {form.discount_type !== 'none' && (
                <Field
                  label={form.discount_type === 'percent' ? 'Discount (%)' : 'Discount (₹)'}
                  inputMode="decimal"
                  value={form.discount_value}
                  onChange={set('discount_value')}
                  error={errors.discount_value}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Field label="GST rate (%)" inputMode="decimal" value={form.gst_rate} onChange={set('gst_rate')} error={errors.gst_rate} />
                <div className="flex flex-wrap gap-2" role="group" aria-label="Common GST rates">
                  {GST_PRESETS.map((rate) => (
                    <FilterChip key={rate} active={Number(form.gst_rate || 0) === rate && !blank(form.gst_rate)} onClick={() => setForm((f) => ({ ...f, gst_rate: String(rate) }))}>
                      {rate}%
                    </FilterChip>
                  ))}
                </div>
              </div>
              <Field
                label="Advance payable (₹)"
                optional
                inputMode="decimal"
                value={form.advance_amount}
                onChange={set('advance_amount')}
                error={errors.advance_amount}
                hint="Shown with the balance due."
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="For the customer" />
          <CardBody className="space-y-4">
            <Field
              label="Valid until"
              type="date"
              min={today}
              className="sm:max-w-xs"
              value={form.valid_until}
              onChange={set('valid_until')}
              error={errors.valid_until}
              hint={form.valid_until ? formatEventDate(form.valid_until) : 'The customer can accept until this date.'}
            />
            <Field
              label="Note to the customer"
              optional
              as="textarea"
              rows={3}
              maxLength={2000}
              value={form.notes_to_customer}
              onChange={set('notes_to_customer')}
            />
            <Field
              label="Terms & conditions"
              optional
              as="textarea"
              rows={6}
              maxLength={10000}
              value={form.terms}
              onChange={set('terms')}
              hint="Payment schedule, cancellation policy, what's included. Carried over to revisions."
            />
          </CardBody>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title={revision ? `Revision ${version.version_number}` : 'Draft'} description={dirty ? 'Unsaved changes' : 'All changes saved'} />
          <CardBody className="space-y-5">
            <QuotationTotals
              version={{ ...form, ...totals, per_person_rate: form.per_person_rate || 0 }}
              charges={form.additional_charges.filter((c) => !blank(c.label) || !blank(c.amount))}
            />
            {missingPrices && <Alert tone="warning">Some items have no price. Add prices or switch to per-person pricing before sending.</Alert>}
            <p className="text-xs text-ink-400">Preview. Final totals are calculated when you save.</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => check(true) && setConfirm('send')} disabled={Boolean(busy)}>
                <Send className="size-4" aria-hidden="true" />
                {revision ? 'Send revision' : 'Send to customer'}
              </Button>
              <Button variant="secondary" onClick={save} loading={busy === 'save'} disabled={!dirty || Boolean(busy)}>
                <Save className="size-4" aria-hidden="true" />
                Save draft
              </Button>
              <Button variant="ghost" className="text-burgundy-600 hover:bg-burgundy-50" onClick={() => setConfirm('discard')} disabled={Boolean(busy)}>
                <Trash2 className="size-4" aria-hidden="true" />
                {quotation.status === 'draft' ? 'Delete quotation' : 'Discard revision'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'send'}
        tone="primary"
        title={revision ? `Send revision ${version.version_number}?` : `Send ${quotation.quotation_number}?`}
        message={
          <>
            <p>
              {quotation.enquiry.contact_name} will be able to review and accept it until {formatEventDate(form.valid_until)}.
              Once sent, this version can't be edited; changes need a new revision.
            </p>
            <p className="mt-3 text-base font-semibold text-ink-900">Total {formatCurrency(totals.total_amount)}</p>
            {revision && <p className="mt-1">The previous version is replaced for the customer.</p>}
          </>
        }
        confirmLabel={dirty ? 'Save and send' : 'Send'}
        loading={busy === 'send'}
        onConfirm={send}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title={quotation.status === 'draft' ? 'Delete this quotation?' : 'Discard this revision?'}
        message={
          quotation.status === 'draft'
            ? "It hasn't been sent, so the customer never saw it. You can create a new one from the enquiry."
            : 'Your changes in this revision are lost. The customer keeps the version they were sent.'
        }
        confirmLabel={quotation.status === 'draft' ? 'Delete quotation' : 'Discard revision'}
        loading={busy === 'discard'}
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
