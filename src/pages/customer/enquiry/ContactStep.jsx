import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import { BUDGET_FLEXIBILITY } from '@/constants/enquiry.js'
import { cn } from '@/utils/cn.js'

export default function ContactStep({ values, errors, onChange }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Contact for this event" description="Pre-filled from your profile. Changes here apply to this enquiry only." />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Contact name" name="contact_name" autoComplete="name" value={values.contact_name} onChange={onChange} error={errors.contact_name} maxLength={120} />
            <Field label="Phone" name="contact_phone" type="tel" autoComplete="tel" value={values.contact_phone} onChange={onChange} error={errors.contact_phone} />
            <Field label="Email" name="contact_email" type="email" autoComplete="email" value={values.contact_email} onChange={onChange} error={errors.contact_email} />
          </div>
          <Field label="Billing address" name="address" as="textarea" optional value={values.address} onChange={onChange} error={errors.address} maxLength={500} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name" name="company_name" optional value={values.company_name} onChange={onChange} error={errors.company_name} maxLength={150} />
            <Field
              label="GST number"
              name="gst_number"
              optional
              placeholder="27ABCDE1234F1Z5"
              value={values.gst_number}
              onChange={onChange}
              error={errors.gst_number}
              maxLength={15}
              inputClassName="uppercase"
              hint="For a GST invoice."
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Budget" description="Optional, but it helps us tailor the menu to you." />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Total budget (₹)"
              name="total_budget"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              optional
              value={values.total_budget}
              onChange={onChange}
              error={errors.total_budget}
            />
            <Field
              label="Per-person budget (₹)"
              name="per_person_budget"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              optional
              value={values.per_person_budget}
              onChange={onChange}
              error={errors.per_person_budget}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-700">How flexible is your budget?</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(BUDGET_FLEXIBILITY).map(([key, { label, hint }]) => (
                <label
                  key={key}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-600',
                    values.budget_flexibility === key ? 'border-forest-600 ring-2 ring-forest-600/15' : 'border-ivory-300 hover:border-forest-600',
                  )}
                >
                  <input
                    type="radio"
                    name="budget_flexibility"
                    value={key}
                    checked={values.budget_flexibility === key}
                    onChange={onChange}
                    className="mt-1 accent-forest-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{label}</span>
                    <span className="block text-xs text-ink-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>
    </div>
  )
}
