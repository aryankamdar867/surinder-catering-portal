import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { BUSINESS } from '../../src/constants/business.js'
import { PRICING_UNITS, QUANTITY_UNITS } from '../../src/constants/catalogue.js'
import { EVENT_TYPES, SERVICE_TYPES } from '../../src/constants/enquiry.js'

// Builds the quotation PDF (A4) from rows read with the caller's own Supabase token.
// Every amount printed is the value saved by the database; nothing is recalculated here.
// Files under api/_lib and api/_fonts are not routes (Vercel ignores _-prefixed paths).

// --- Formatting helpers (exported for tests) ---------------------------------

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatINR = (value) => (Number.isFinite(Number(value)) ? inr.format(Number(value)) : '—')

const qtyFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
export const formatQty = (n) => qtyFormat.format(Number(n))

const longDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
/** YYYY-MM-DD → "14 February 2027" (no timezone shift). */
export function formatIsoDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return longDate.format(new Date(Date.UTC(y, m - 1, d)))
}

const istDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const istDateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
})
export const formatTimestamp = (ts) => (ts ? istDate.format(new Date(ts)) : '—')

/** "18:30:00" → "6:30 pm" */
export function formatTime(value) {
  if (!value) return null
  const [h, min] = value.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

export const todayInIndia = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n) {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
}
function belowThousand(n) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}
/** Whole number in the Indian system (crore, lakh, thousand). */
function integerInWords(n) {
  if (n === 0) return 'Zero'
  const parts = []
  const crore = Math.floor(n / 1e7)
  if (crore) parts.push(`${integerInWords(crore)} Crore`)
  let rest = n % 1e7
  const lakh = Math.floor(rest / 1e5)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  rest %= 1e5
  const thousand = Math.floor(rest / 1000)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  rest %= 1000
  if (rest) parts.push(belowThousand(rest))
  return parts.join(' ')
}
/** 123456.5 → "Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Fifty Paise Only" */
export function amountInWords(value) {
  const paiseTotal = Math.round(Math.abs(Number(value)) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  return `Rupees ${integerInWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`
}

/** Items grouped by category in their saved order (same rule as src/utils/quotation.js). */
export function groupItems(items) {
  const groups = new Map()
  for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const name = item.category_name || 'Other items'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(item)
  }
  return [...groups].map(([name, list]) => ({ name, items: list }))
}

/**
 * What the PDF should say about this version's state. `watermark` is printed across
 * every page; `banner` is a line under the title.
 */
export function versionState(quotation, version, today = todayInIndia()) {
  const isCurrent = quotation.current_version_id === version.id
  if (version.status === 'draft')
    return { watermark: 'DRAFT', banner: 'Draft preview: not yet sent to the customer.', tone: 'muted' }
  if (version.status === 'superseded' || !isCurrent)
    return { watermark: 'SUPERSEDED', banner: 'Superseded: this version was replaced by a later revision.', tone: 'muted' }
  switch (quotation.status) {
    case 'accepted':
      return { banner: `Accepted by the customer on ${formatTimestamp(quotation.responded_at)}.`, tone: 'good' }
    case 'rejected':
      return { watermark: 'DECLINED', banner: `Declined by the customer on ${formatTimestamp(quotation.responded_at)}.`, tone: 'bad' }
    case 'withdrawn':
      return { watermark: 'WITHDRAWN', banner: 'Withdrawn: this quotation is no longer on offer.', tone: 'bad' }
    default:
      if (version.valid_until && version.valid_until < today)
        return { watermark: 'EXPIRED', banner: `Expired on ${formatIsoDate(version.valid_until)}. Please contact us for an updated quotation.`, tone: 'bad' }
      return { banner: null }
  }
}

export const pdfFilename = (quotation, version) =>
  `${quotation.quotation_number}${version.version_number > 1 ? `-v${version.version_number}` : ''}${version.status === 'draft' ? '-draft' : ''}.pdf`
    .replace(/[^A-Za-z0-9._-]/g, '_')

// --- Fonts ----------------------------------------------------------------------

function fontPath(file) {
  const candidates = [
    fileURLToPath(new URL(`../_fonts/${file}`, import.meta.url)),
    path.join(process.cwd(), 'api', '_fonts', file),
  ]
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) throw new Error(`Font ${file} not found`)
  return found
}

// --- Rendering --------------------------------------------------------------------

const C = {
  forest: '#173b2c', forestSoft: '#eef5f0', gold: '#b8893a', goldSoft: '#f7efe0', burgundy: '#7a2333',
  ink: '#1d1a16', muted: '#6b6358', faint: '#8d857a', line: '#e5dcc8', ivory: '#fdfbf6',
}
const MARGIN = 48
const NO_LIGATURES = { liga: false, clig: false, dlig: false }

// "1 guest", "2 guests", "0.5 kg"
const SINGULAR = { guests: 'guest', plates: 'plate', pieces: 'piece', litres: 'litre', trays: 'tray', counters: 'counter' }
export function unitLabel(pricingUnit, quantity) {
  const plural = QUANTITY_UNITS[pricingUnit] ?? ''
  return Number(quantity) === 1 ? (SINGULAR[plural] ?? plural) : plural
}

const present = (...values) => values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '')

/**
 * @param {{ quotation, version, enquiry, event }} data  rows as returned by Supabase
 * @returns {Promise<Buffer>}
 */
export function renderQuotationPdf({ quotation, version, enquiry, event }, { now = new Date() } = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN + 18, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `Quotation ${quotation.quotation_number}${version.version_number > 1 ? ` (revision ${version.version_number})` : ''}`,
      Author: BUSINESS.name,
      Subject: `Quotation for ${enquiry?.contact_name ?? 'customer'}`,
      Creator: `${BUSINESS.name} portal`,
    },
  })
  doc.registerFont('regular', fontPath('NotoSans-Regular.ttf'))
  doc.registerFont('bold', fontPath('NotoSans-Bold.ttf'))
  doc.font('regular')

  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const left = MARGIN
  const width = doc.page.width - MARGIN * 2
  const right = left + width
  const bottom = () => doc.page.height - doc.page.margins.bottom
  const state = versionState(quotation, version, todayInIndia(now))
  const perPerson = version.pricing_mode === 'per_person'

  const text = (str, x, y, opts = {}) => {
    const { font = 'regular', size = 9.5, color = C.ink, ...rest } = opts
    // No ligatures: with them, copied/searched text loses letters ("staff" → "staf").
    doc.font(font).fontSize(size).fillColor(color).text(str, x, y, { features: NO_LIGATURES, ...rest })
  }
  const rule = (y, color = C.line, w = 0.75) =>
    doc.moveTo(left, y).lineTo(right, y).lineWidth(w).strokeColor(color).stroke()
  const ensure = (h) => {
    if (doc.y + h > bottom()) doc.addPage()
  }

  // ---- Header -------------------------------------------------------------------
  let y = MARGIN
  doc.rect(0, 0, doc.page.width, 6).fill(C.forest)
  text(BUSINESS.name, left, y, { font: 'bold', size: 20, color: C.forest, width: width * 0.58 })
  let hy = doc.y
  if (BUSINESS.tagline) {
    text(BUSINESS.tagline, left, hy, { size: 9, color: C.gold, width: width * 0.58 })
    hy = doc.y
  }
  const contact = present(BUSINESS.address, present(BUSINESS.phone, BUSINESS.email).join('  ·  '), BUSINESS.website,
    BUSINESS.gstin && `GSTIN: ${BUSINESS.gstin}`)
  if (contact.length) text(contact.join('\n'), left, hy + 4, { size: 8.5, color: C.muted, width: width * 0.58, lineGap: 1 })
  const headerBottom = doc.y

  // Title block (right)
  const tx = left + width * 0.6
  const tw = width * 0.4
  text('QUOTATION', tx, y + 2, { font: 'bold', size: 18, color: C.ink, width: tw, align: 'right', characterSpacing: 1.5 })
  const meta = [
    ['Number', quotation.quotation_number],
    version.version_number > 1 && ['Revision', String(version.version_number)],
    ['Date', formatTimestamp(version.sent_at ?? now)],
    ['Valid until', formatIsoDate(version.valid_until)],
    enquiry?.enquiry_number && ['Enquiry', enquiry.enquiry_number],
  ].filter(Boolean)
  let my = doc.y + 6
  for (const [label, value] of meta) {
    text(label, tx, my, { size: 8.5, color: C.muted, width: tw * 0.45 })
    text(value, tx + tw * 0.45, my, { font: 'bold', size: 8.5, width: tw * 0.55, align: 'right' })
    my = doc.y + 2
  }
  y = Math.max(headerBottom, my) + 14
  rule(y, C.forest, 1.2)
  y += 12

  // ---- Status banner -------------------------------------------------------------
  if (state.banner) {
    const colors = { good: [C.forestSoft, C.forest], bad: ['#f6e7ea', C.burgundy], muted: [C.goldSoft, C.muted] }[state.tone] ?? [C.goldSoft, C.muted]
    doc.font('bold').fontSize(9)
    const h = doc.heightOfString(state.banner, { width: width - 20 }) + 12
    doc.roundedRect(left, y, width, h, 4).fill(colors[0])
    text(state.banner, left + 10, y + 6, { font: 'bold', size: 9, color: colors[1], width: width - 20 })
    y += h + 12
  }

  // ---- Customer and event ---------------------------------------------------------
  const colW = (width - 20) / 2
  const block = (title, lines, x, top) => {
    text(title.toUpperCase(), x, top, { font: 'bold', size: 7.5, color: C.gold, characterSpacing: 1.2, width: colW })
    let by = doc.y + 3
    for (const [i, line] of lines.entries()) {
      text(line, x, by, { font: i === 0 ? 'bold' : 'regular', size: i === 0 ? 10 : 9, color: i === 0 ? C.ink : C.muted, width: colW, lineGap: 1 })
      by = doc.y + 1
    }
    return by
  }
  const customerLines = present(
    enquiry?.contact_name, enquiry?.company_name, enquiry?.address,
    present(enquiry?.contact_phone, enquiry?.contact_email).join('  ·  '),
    enquiry?.gst_number && `GSTIN: ${enquiry.gst_number}`,
  )
  const eventName = event ? (event.event_type === 'other' ? event.event_type_other : EVENT_TYPES[event.event_type]) : null
  const eventLines = present(
    eventName ?? 'Event',
    event && [formatIsoDate(event.event_date), formatTime(event.event_time)].filter(Boolean).join(' at '),
    event && present(event.venue_name, event.venue_address).join(', '),
    `${formatQty(version.guest_count)} guests${event?.service_type ? `  ·  ${SERVICE_TYPES[event.service_type]?.label ?? ''}` : ''}`,
  )
  const b1 = block('Prepared for', customerLines, left, y)
  const b2 = block('Event', eventLines, left + colW + 20, y)
  doc.y = Math.max(b1, b2) + 16

  // ---- Items table ---------------------------------------------------------------
  const cols = perPerson
    ? [{ key: 'item', w: width - 120 }, { key: 'qty', w: 120, align: 'right' }]
    : [{ key: 'item', w: width - 290 }, { key: 'qty', w: 90, align: 'right' }, { key: 'rate', w: 110, align: 'right' }, { key: 'amount', w: 90, align: 'right' }]
  const headLabels = { item: 'Item', qty: 'Quantity', rate: 'Rate', amount: 'Amount' }
  const cellX = (i) => left + cols.slice(0, i).reduce((s, c) => s + c.w, 0)

  const tableHeader = () => {
    const top = doc.y
    doc.rect(left, top, width, 20).fill(C.forest)
    cols.forEach((c, i) =>
      text(headLabels[c.key], cellX(i) + 8, top + 5.5, { font: 'bold', size: 8, color: C.ivory, width: c.w - 16, align: c.align ?? 'left' }))
    doc.y = top + 24
  }
  doc.on('pageAdded', () => {
    doc.y = doc.page.margins.top
  })

  ensure(60)
  tableHeader()
  for (const group of groupItems(version.items ?? [])) {
    if (doc.y + 40 > bottom()) {
      doc.addPage()
      tableHeader()
    }
    text(group.name.toUpperCase(), left + 8, doc.y + 2, { font: 'bold', size: 7.5, color: C.gold, characterSpacing: 1.1, width: width - 16 })
    doc.y += 3
    for (const item of group.items) {
      const unitWord = unitLabel(item.pricing_unit, item.quantity)
      const values = {
        qty: `${formatQty(item.quantity)} ${unitWord}`.trim(),
        rate: item.unit_price === null ? 'On request' : `${formatINR(item.unit_price)} ${PRICING_UNITS[item.pricing_unit] ?? ''}`.trim(),
        amount: item.unit_price === null ? '—' : formatINR(item.line_total),
      }
      doc.font('regular').fontSize(9.5)
      const nameH = doc.heightOfString(item.dish_name, { width: cols[0].w - 16 })
      doc.fontSize(8)
      const descH = item.description ? doc.heightOfString(item.description, { width: cols[0].w - 16 }) + 1 : 0
      doc.fontSize(8.5)
      const rateH = perPerson ? 0 : doc.heightOfString(values.rate, { width: cols[2].w - 16 })
      const rowH = Math.max(nameH + descH, rateH) + 9
      if (doc.y + rowH > bottom()) {
        doc.addPage()
        tableHeader()
        text(`${group.name.toUpperCase()} (CONTINUED)`, left + 8, doc.y + 2, { font: 'bold', size: 7.5, color: C.gold, characterSpacing: 1.1 })
        doc.y += 3
      }
      const top = doc.y
      text(item.dish_name, cellX(0) + 8, top + 4.5, { size: 9.5, width: cols[0].w - 16 })
      if (item.description) text(item.description, cellX(0) + 8, doc.y + 1, { size: 8, color: C.faint, width: cols[0].w - 16 })
      cols.slice(1).forEach((c, i) =>
        text(values[c.key], cellX(i + 1) + 8, top + 5, { size: 8.5, color: c.key === 'amount' ? C.ink : C.muted, font: c.key === 'amount' ? 'bold' : 'regular', width: c.w - 16, align: 'right' }))
      doc.y = top + rowH
      rule(doc.y - 0.5)
    }
    doc.y += 6
  }
  if (perPerson) {
    ensure(20)
    text('Priced per person for the whole menu; see the total below.', left + 8, doc.y + 2, { size: 8, color: C.faint, width: width - 16 })
  }
  doc.y += 12

  // ---- Totals -------------------------------------------------------------------
  const rows = [
    [perPerson ? `${formatQty(version.guest_count)} guests × ${formatINR(version.per_person_rate)}` : 'Menu total', formatINR(version.subtotal)],
    ...(version.additional_charges ?? []).map((c) => [c.label, formatINR(c.amount)]),
    Number(version.discount_amount) > 0 && [
      version.discount_type === 'percent' ? `Discount (${Number(version.discount_value)}%)` : 'Discount',
      `− ${formatINR(version.discount_amount)}`,
    ],
    Number(version.gst_rate) > 0 && ['Taxable amount', formatINR(version.taxable_amount), 'muted'],
    Number(version.gst_rate) > 0 && [`GST (${Number(version.gst_rate)}%)`, formatINR(version.gst_amount)],
  ].filter(Boolean)
  const totalsW = 250
  const totalsX = right - totalsW
  const totalsH = rows.length * 16 + 34 + (Number(version.advance_amount) > 0 ? 36 : 0) + 30
  ensure(totalsH)
  let ty = doc.y
  for (const [label, value, muted] of rows) {
    text(label, totalsX, ty, { size: 9, color: muted ? C.faint : C.muted, width: totalsW - 110 })
    text(value, totalsX + totalsW - 110, ty, { size: 9, width: 110, align: 'right' })
    ty = Math.max(doc.y, ty + 16)
  }
  ty += 2
  doc.roundedRect(totalsX - 10, ty, totalsW + 10, 28, 4).fill(C.forest)
  text('Total', totalsX, ty + 7, { font: 'bold', size: 11, color: C.ivory, width: 100 })
  text(formatINR(version.total_amount), totalsX + 90, ty + 6.5, { font: 'bold', size: 12, color: C.ivory, width: totalsW - 98, align: 'right' })
  ty += 34
  if (Number(version.advance_amount) > 0) {
    for (const [label, value] of [['Advance payable', formatINR(version.advance_amount)], ['Balance', formatINR(version.balance_amount)]]) {
      text(label, totalsX, ty, { size: 9, color: C.muted, width: totalsW - 110 })
      text(value, totalsX + totalsW - 110, ty, { font: 'bold', size: 9, width: 110, align: 'right' })
      ty += 16
    }
  }
  text(amountInWords(version.total_amount), left, ty + 4, { size: 8.5, color: C.muted, width, align: 'right', oblique: true })
  doc.y = Math.max(doc.y, ty + 4) + 18

  // ---- Payment details, note, terms ------------------------------------------------
  const p = BUSINESS.payment ?? {}
  const payLines = [
    ['Account name', p.accountName], ['Bank', p.bankName], ['Account number', p.accountNumber],
    ['IFSC', p.ifsc], ['Branch', p.branch], ['UPI', p.upiId],
  ].filter(([, v]) => present(v).length)
  const section = (title, body, opts = {}) => {
    doc.font('regular').fontSize(9)
    ensure(Math.min(40 + doc.heightOfString(body, { width }), 120))
    text(title.toUpperCase(), left, doc.y, { font: 'bold', size: 7.5, color: C.gold, characterSpacing: 1.2 })
    text(body, left, doc.y + 3, { size: 9, color: opts.color ?? C.ink, width, lineGap: 1.5 })
    doc.y += 14
  }
  if (payLines.length) {
    ensure(30 + payLines.length * 14)
    text('PAYMENT DETAILS', left, doc.y, { font: 'bold', size: 7.5, color: C.gold, characterSpacing: 1.2 })
    let py = doc.y + 4
    for (const [label, value] of payLines) {
      text(label, left, py, { size: 9, color: C.muted, width: 110 })
      text(value, left + 110, py, { font: 'bold', size: 9, width: width - 110 })
      py = doc.y + 2
    }
    doc.y = py + 12
  }
  if (version.notes_to_customer) section('Note from us', version.notes_to_customer)
  if (version.terms) section('Terms & conditions', version.terms, { color: C.muted })

  // ---- Watermark and footer on every page -------------------------------------------
  const range = doc.bufferedPageRange()
  const generated = istDateTime.format(now)
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    if (state.watermark) {
      // Size the word to fit across the page on one line, then centre it.
      doc.font('bold').fontSize(1)
      const size = Math.min(92, 520 / doc.widthOfString(state.watermark, { features: NO_LIGATURES }))
      doc.fontSize(size)
      const w = doc.widthOfString(state.watermark, { features: NO_LIGATURES })
      const cx = doc.page.width / 2
      const cy = doc.page.height / 2
      doc.save()
      doc.rotate(-35, { origin: [cx, cy] })
      doc.fillColor(state.tone === 'bad' ? C.burgundy : C.faint).fillOpacity(0.08)
      doc.text(state.watermark, cx - w / 2, cy - size * 0.7, { width: w + 4, lineBreak: false, features: NO_LIGATURES })
      doc.restore()
      doc.fillOpacity(1)
    }
    const fy = doc.page.height - MARGIN + 4
    doc.moveTo(left, fy - 6).lineTo(right, fy - 6).lineWidth(0.5).strokeColor(C.line).stroke()
    text(`${BUSINESS.name}  ·  ${quotation.quotation_number}${version.version_number > 1 ? ` v${version.version_number}` : ''}  ·  Generated ${generated}`,
      left, fy, { size: 7.5, color: C.faint, width: width - 80, lineBreak: false })
    text(`Page ${i - range.start + 1} of ${range.count}`, right - 80, fy, { size: 7.5, color: C.faint, width: 80, align: 'right', lineBreak: false })
    doc.page.margins.bottom = savedBottom
  }

  doc.end()
  return done
}
