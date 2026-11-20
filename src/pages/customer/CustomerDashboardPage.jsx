import { ArrowRight, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { formatDate } from '@/utils/format.js'

export default function CustomerDashboardPage() {
  const { profile } = useAuth()
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'there'
  const missing = [!profile.phone && 'phone number', !profile.address && 'address'].filter(Boolean)

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title={`Welcome, ${firstName}`}
        description="Your personal space for planning events with Surinder Caterers."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {missing.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 bg-gradient-to-br from-forest-800 to-forest-900 p-6 text-ivory-50 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h2 className="text-3xl font-semibold">Complete your profile</h2>
                <p className="mt-2 max-w-md text-sm text-ivory-200/80">
                  Add your {missing.join(' and ')} so our team can reach you and prepare quotations faster.
                </p>
              </div>
              <Button to="/account/profile" variant="secondary" className="shrink-0">
                Update profile
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <CardBody className="py-8">
              <h2 className="text-3xl font-semibold text-forest-900">Your profile is complete</h2>
              <p className="mt-2 text-sm text-ink-500">
                Thank you. We have everything we need to get in touch about your events.
              </p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Your details"
            action={
              <Button to="/account/profile" variant="ghost" size="sm">
                <UserRound className="size-4" aria-hidden="true" />
                Edit
              </Button>
            }
          />
          <CardBody>
            <dl className="space-y-3 text-sm">
              {[
                ['Name', profile.full_name || '—'],
                ['Email', profile.email],
                ['Phone', profile.phone || '—'],
                ['Member since', formatDate(profile.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="truncate text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
