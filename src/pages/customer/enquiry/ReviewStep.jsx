import { Pencil } from 'lucide-react'
import DietMark from '@/components/catalogue/DietMark.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import { QUANTITY_UNITS } from '@/constants/catalogue.js'
import { BUDGET_FLEXIBILITY, EVENT_TYPES, SERVICE_TYPES } from '@/constants/enquiry.js'
import { formatEventDate, formatTime } from '@/utils/dates.js'
import { formatCurrency } from '@/utils/format.js'
import { priceLabel } from '@/utils/catalogue.js'
import { estimateAmount, estimateNote, estimateTotal } from './enquiryDraft.js'

export function DetailList({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([label, value, wide]) => (
          <div key={label} className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="text-ink-400">{label}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words font-medium text-ink-900">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

const money = (v) => (String(v).trim() ? formatCurrency(v) : null)

export default function ReviewStep({ draft, menu, onEdit }) {
  const { event: e, contact: c } = draft
  const dishById = new Map(menu.dishes.map((d) => [d.id, d]))
  const editButton = (step, label) => (
    <Button variant="ghost" size="sm" onClick={() => onEdit(step)} aria-label={`Edit ${label}`}>
      <Pencil className="size-4" aria-hidden="true" />
      Edit
    </Button>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Event" action={editButton(0, 'event')} />
        <CardBody>
          <DetailList
            items={[
              ['Event', e.event_type === 'other' ? e.event_type_other : EVENT_TYPES[e.event_type]],
              ['Date', `${formatEventDate(e.event_date)}${e.event_time ? ` · ${formatTime(e.event_time)}` : ''}`],
              ['Guests', Number(e.guest_count).toLocaleString('en-IN')],
              ['Service', SERVICE_TYPES[e.service_type]?.label],
              ['Venue', [e.venue_name, e.venue_address].filter((v) => v.trim()).join('\n'), true],
              ['Cuisines', e.cuisine_preferences.join(', '), true],
              ['Dietary requirements', e.dietary_requirements.trim(), true],
              ['Special instructions', e.special_instructions.trim(), true],
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Menu" action={editButton(1, 'menu')} />
        <CardBody>
          {draft.dishes.length === 0 ? (
            <p className="text-sm text-ink-500">No dishes selected – our team will suggest a menu.</p>
          ) : (
            <>
              <ul className="divide-y divide-ivory-200">
                {draft.dishes.map((s) => {
                  const dish = dishById.get(s.dish_id)
                  if (!dish) return null
                  return (
                    <li key={s.dish_id} className="flex items-center gap-3 py-2.5 text-sm">
                      <DietMark labels={dish.dietary_labels} />
                      <span className="min-w-0 flex-1 font-medium text-ink-900">{dish.name}</span>
                      <span className="text-ink-500">
                        {Number(s.quantity).toLocaleString('en-IN')} {QUANTITY_UNITS[dish.pricing_unit]} × {priceLabel(dish.price, dish.pricing_unit)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 flex justify-between border-t border-ivory-200 pt-4 text-sm">
                <span className="font-medium text-ink-700">Estimated menu total</span>
                <span className="text-lg font-semibold text-forest-800">{estimateAmount(estimateTotal(draft.dishes, dishById))}</span>
              </p>
              {estimateNote(estimateTotal(draft.dishes, dishById)) && (
                <p className="mt-1 text-xs text-ink-500">{estimateNote(estimateTotal(draft.dishes, dishById))}</p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact & budget" action={editButton(2, 'contact and budget')} />
        <CardBody>
          <DetailList
            items={[
              ['Contact', c.contact_name],
              ['Phone', c.contact_phone],
              ['Email', c.contact_email],
              ['Company', c.company_name.trim()],
              ['GST number', c.gst_number.trim().toUpperCase()],
              ['Billing address', c.address.trim(), true],
              ['Total budget', money(c.total_budget)],
              ['Per-person budget', money(c.per_person_budget)],
              ['Budget flexibility', BUDGET_FLEXIBILITY[c.budget_flexibility]?.label],
            ]}
          />
        </CardBody>
      </Card>
    </div>
  )
}
