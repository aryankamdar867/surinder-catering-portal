import { todayInIndia } from '@/utils/dates.js'

// Live preview of quotation totals while the owner edits a draft. This mirrors
// quotation_versions_before_write() in the database, which is the source of truth:
// saved totals always come back from the server.

/**
 * Round half away from zero to 2 decimals, like PostgreSQL's round(numeric, 2).
 * toPrecision(15) strips binary noise first (e.g. 0.285 stored as 0.28499999…).
 */
export const round2 = (n) => Math.sign(n) * (Math.round(Number((Math.abs(n) * 100).toPrecision(15))) / 100)

// The database stores every entered amount rounded to 2 decimals (parse_quote_amount),
// so the preview rounds inputs the same way before calculating.
const toNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? round2(n) : null
}

export const lineTotal = (item) => {
  const price = toNumber(item.unit_price)
  const qty = toNumber(item.quantity)
  return price === null || qty === null ? null : round2(price * qty)
}

export function computeTotals(draft) {
  const itemsTotal = round2(draft.items.reduce((sum, item) => sum + (lineTotal(item) ?? 0), 0))
  const guests = toNumber(draft.guest_count) ?? 0
  const rate = toNumber(draft.per_person_rate) ?? 0
  const subtotal = draft.pricing_mode === 'per_person' ? round2(guests * rate) : itemsTotal
  const charges = round2(draft.additional_charges.reduce((sum, c) => sum + (toNumber(c.amount) ?? 0), 0))
  const gross = round2(subtotal + charges)
  const discountValue = toNumber(draft.discount_value) ?? 0
  const discount =
    draft.discount_type === 'amount'
      ? round2(discountValue)
      : draft.discount_type === 'percent'
        ? round2((gross * discountValue) / 100)
        : 0
  const taxable = round2(gross - discount)
  const gst = round2((taxable * (toNumber(draft.gst_rate) ?? 0)) / 100)
  const total = round2(taxable + gst)
  const advance = toNumber(draft.advance_amount) ?? 0
  return {
    items_total: itemsTotal,
    subtotal,
    additional_charges_total: charges,
    discount_amount: discount,
    taxable_amount: taxable,
    gst_amount: gst,
    total_amount: total,
    advance_amount: advance,
    balance_amount: round2(total - advance),
    gross,
  }
}

/** A sent quotation past its valid-until date (India time). */
export const isExpired = (version) => Boolean(version?.valid_until) && version.valid_until < todayInIndia()

/** The draft version (at most one), if any. */
export const draftVersion = (quotation) => quotation?.versions?.find((v) => v.status === 'draft') ?? null

/** The version the customer currently sees. */
export const currentVersion = (quotation) =>
  quotation?.versions?.find((v) => v.id === quotation.current_version_id) ?? null

/** Display status: a sent quotation past its date shows as expired. */
export function displayStatus(quotation) {
  if (quotation.status === 'sent' && isExpired(currentVersion(quotation))) return 'expired'
  return quotation.status
}

/** Items grouped by category in their saved order: [{ name, items }]. */
export function groupItems(items) {
  const groups = []
  const byName = new Map()
  for (const item of items) {
    const name = item.category_name || 'Other items'
    if (!byName.has(name)) {
      const group = { name, items: [] }
      byName.set(name, group)
      groups.push(group)
    }
    byName.get(name).items.push(item)
  }
  return groups
}
