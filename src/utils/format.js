const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

const relativeFormatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
const RELATIVE_STEPS = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
]

/** "just now", "5 minutes ago", "yesterday", … then a plain date after a week. */
export function formatRelativeTime(value, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  let diff = (date.getTime() - now) / 1000
  if (Math.abs(diff) < 45) return 'just now'
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(diff) < size) return relativeFormatter.format(Math.round(diff), unit)
    diff /= size
  }
  return formatDate(date)
}

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export function formatCurrency(value) {
  const n = Number(value)
  return Number.isFinite(n) ? currencyFormatter.format(n) : '—'
}
