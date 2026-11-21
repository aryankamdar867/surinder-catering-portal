import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import ChipToggle from '@/components/ui/ChipToggle.jsx'
import Field from '@/components/ui/Field.jsx'
import { EVENT_TYPES, SERVICE_TYPES } from '@/constants/enquiry.js'
import { cn } from '@/utils/cn.js'
import { eventLimits } from './enquiryDraft.js'

export default function EventStep({ values, errors, onChange, setValue, cuisines }) {
  const { min, max } = eventLimits()

  const toggleCuisine = (name, on) =>
    setValue('cuisine_preferences', on ? [...values.cuisine_preferences, name] : values.cuisine_preferences.filter((c) => c !== name))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Your event" />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type of event" name="event_type" as="select" value={values.event_type} onChange={onChange} error={errors.event_type}>
              <option value="">Choose…</option>
              {Object.entries(EVENT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Field>
            {values.event_type === 'other' && (
              <Field
                label="Describe the event"
                name="event_type_other"
                value={values.event_type_other}
                onChange={onChange}
                error={errors.event_type_other}
                maxLength={80}
                placeholder="e.g. Naming ceremony"
              />
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Date"
              name="event_date"
              type="date"
              min={min}
              max={max}
              value={values.event_date}
              onChange={onChange}
              error={errors.event_date}
            />
            <Field label="Start time" name="event_time" type="time" optional value={values.event_time} onChange={onChange} />
            <Field
              label="Number of guests"
              name="guest_count"
              type="number"
              inputMode="numeric"
              min="1"
              max="100000"
              step="1"
              value={values.guest_count}
              onChange={onChange}
              error={errors.guest_count}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Venue name" name="venue_name" value={values.venue_name} onChange={onChange} error={errors.venue_name} maxLength={200} />
            <Field
              label="Venue address"
              name="venue_address"
              optional
              value={values.venue_address}
              onChange={onChange}
              error={errors.venue_address}
              maxLength={500}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Service style" />
        <CardBody>
          <fieldset aria-describedby={errors.service_type ? 'service-error' : undefined}>
            <legend className="sr-only">Service style</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(SERVICE_TYPES).map(([key, { label, hint }]) => (
                <label
                  key={key}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-600',
                    values.service_type === key ? 'border-forest-600 ring-2 ring-forest-600/15' : 'border-ivory-300 hover:border-forest-600',
                  )}
                >
                  <input
                    type="radio"
                    name="service_type"
                    value={key}
                    checked={values.service_type === key}
                    onChange={onChange}
                    aria-invalid={errors.service_type ? true : undefined}
                    className="mt-1 accent-forest-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{label}</span>
                    <span className="block text-xs text-ink-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.service_type && (
              <p id="service-error" className="mt-2 text-xs font-medium text-burgundy-600">
                {errors.service_type}
              </p>
            )}
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preferences" description="Optional – helps us suggest the right menu." />
        <CardBody className="space-y-5">
          {cuisines.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-700">Cuisines you'd like</legend>
              <div className="flex flex-wrap gap-2">
                {cuisines.map((c) => (
                  <ChipToggle key={c.id} checked={values.cuisine_preferences.includes(c.name)} onChange={(on) => toggleCuisine(c.name, on)}>
                    {c.name}
                  </ChipToggle>
                ))}
              </div>
            </fieldset>
          )}
          <Field
            label="Dietary requirements"
            name="dietary_requirements"
            as="textarea"
            optional
            placeholder="e.g. 60% vegetarian, 20 Jain guests, no onion-garlic at the main counter"
            value={values.dietary_requirements}
            onChange={onChange}
            error={errors.dietary_requirements}
            maxLength={1000}
          />
          <Field
            label="Anything else we should know?"
            name="special_instructions"
            as="textarea"
            optional
            value={values.special_instructions}
            onChange={onChange}
            error={errors.special_instructions}
            maxLength={2000}
          />
        </CardBody>
      </Card>
    </div>
  )
}
