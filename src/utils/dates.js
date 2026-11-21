// Event dates are validated against India time on the server; mirror that here.

const isoInIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia() {
  return isoInIndia.format(new Date())
}

/** Add days (or years) to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addToIsoDate(iso, { days = 0, years = 0 }) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y + years, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Format a YYYY-MM-DD date without timezone shifting, e.g. "Sat, 14 February 2027". */
export function formatEventDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return longDate.format(new Date(Date.UTC(y, m - 1, d)))
}

/** "18:30:00" → "6:30 pm" */
export function formatTime(value) {
  if (!value) return null
  const [h, min] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${suffix}`
}
