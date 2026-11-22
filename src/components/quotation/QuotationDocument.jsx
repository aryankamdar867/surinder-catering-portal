import Badge from '@/components/ui/Badge.jsx'
import { PRICING_UNITS, QUANTITY_UNITS } from '@/constants/catalogue.js'
import { QUOTATION_STATUS } from '@/constants/quotation.js'
import { formatEventDate } from '@/utils/dates.js'
import { formatCurrency, formatDate } from '@/utils/format.js'
import { groupItems } from '@/utils/quotation.js'

export function QuotationStatusBadge({ status, className }) {
  const meta = QUOTATION_STATUS[status] ?? { label: status, tone: 'neutral' }
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  )
}

const qty = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })

function TotalRow({ label, value, strong, muted }) {
  return (
    <div className={strong ? 'flex justify-between border-t border-ivory-200 pt-3 text-base' : 'flex justify-between'}>
      <dt className={strong ? 'font-semibold text-ink-900' : muted ? 'text-ink-400' : 'text-ink-500'}>{label}</dt>
      <dd className={strong ? 'text-lg font-semibold text-forest-800' : 'font-medium text-ink-900'}>{value}</dd>
    </div>
  )
}

/** The totals ladder. `t` has the same shape as a saved quotation version. */
export function QuotationTotals({ version: t, charges = t.additional_charges }) {
  const perPerson = t.pricing_mode === 'per_person'
  return (
    <dl className="space-y-2 text-sm">
      <TotalRow
        label={perPerson ? `${qty(t.guest_count)} guests × ${formatCurrency(t.per_person_rate)}` : 'Menu total'}
        value={formatCurrency(t.subtotal)}
      />
      {charges.map((c, i) => (
        <TotalRow key={`${c.label}-${i}`} label={c.label || 'Additional charge'} value={formatCurrency(c.amount)} />
      ))}
      {Number(t.discount_amount) > 0 && (
        <TotalRow
          label={t.discount_type === 'percent' ? `Discount (${Number(t.discount_value)}%)` : 'Discount'}
          value={`− ${formatCurrency(t.discount_amount)}`}
        />
      )}
      {Number(t.gst_rate) > 0 && (
        <>
          <TotalRow label="Taxable amount" value={formatCurrency(t.taxable_amount)} muted />
          <TotalRow label={`GST (${Number(t.gst_rate)}%)`} value={formatCurrency(t.gst_amount)} />
        </>
      )}
      <TotalRow label="Total" value={formatCurrency(t.total_amount)} strong />
      {Number(t.advance_amount) > 0 && (
        <>
          <TotalRow label="Advance payable" value={formatCurrency(t.advance_amount)} />
          <TotalRow label="Balance" value={formatCurrency(t.balance_amount)} />
        </>
      )}
    </dl>
  )
}

/**
 * Read-only quotation as the customer sees it. Used on the customer quotation page
 * and as the owner's preview of sent versions.
 */
export default function QuotationDocument({ quotation, version }) {
  const perPerson = version.pricing_mode === 'per_person'
  const groups = groupItems(version.items)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-500">
        <p>
          <span className="font-semibold text-ink-900">{quotation.quotation_number}</span>
          {version.version_number > 1 && ` · revision ${version.version_number}`}
        </p>
        <p>
          {version.sent_at && <>Sent {formatDate(version.sent_at)} · </>}
          Valid until <span className="font-medium text-ink-900">{formatEventDate(version.valid_until)}</span>
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.name}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{group.name}</h3>
            <ul className="divide-y divide-ivory-200 border-y border-ivory-200">
              {group.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ink-900">{item.dish_name}</span>
                    {item.description && <span className="block text-xs text-ink-400">{item.description}</span>}
                  </span>
                  {perPerson ? (
                    <span className="text-ink-500">
                      {qty(item.quantity)} {QUANTITY_UNITS[item.pricing_unit] ?? ''}
                    </span>
                  ) : (
                    <>
                      <span className="text-ink-500">
                        {qty(item.quantity)} {QUANTITY_UNITS[item.pricing_unit] ?? ''} × {formatCurrency(item.unit_price)}{' '}
                        <span className="text-ink-400">{PRICING_UNITS[item.pricing_unit]}</span>
                      </span>
                      <span className="w-28 text-right font-semibold text-ink-900">{formatCurrency(item.line_total)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="ml-auto max-w-sm">
        <QuotationTotals version={version} />
      </div>

      {version.notes_to_customer && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink-900">Note from us</h3>
          <p className="whitespace-pre-line text-sm text-ink-700">{version.notes_to_customer}</p>
        </section>
      )}
      {version.terms && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink-900">Terms & conditions</h3>
          <p className="whitespace-pre-line text-sm text-ink-500">{version.terms}</p>
        </section>
      )}
    </div>
  )
}
