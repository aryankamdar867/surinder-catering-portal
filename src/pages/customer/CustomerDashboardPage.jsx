import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, UserRound, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { eventTitle } from '@/constants/enquiry.js'
import { useAsync } from '@/hooks/useAsync.js'
import EnquiryStatusBadge from '@/pages/customer/enquiry/EnquiryStatusBadge.jsx'
import { listMyEnquiries } from '@/services/enquiryService.js'
import { formatEventDate } from '@/utils/dates.js'
import { formatDate } from '@/utils/format.js'

function EnquiryCard({ userId }) {
  const { data } = useAsync(() => listMyEnquiries(userId, { limit: 1 }), [userId])
  const latest = data?.[0]
  return (
    <Card className="lg:col-start-1">
      <CardBody className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
            <CalendarPlus className="size-5" aria-hidden="true" />
          </span>
          {latest ? (
            <div className="min-w-0">
              <h2 className="font-sans text-base font-semibold tracking-normal text-ink-900">Your latest enquiry</h2>
              <Link to={`/account/enquiries/${latest.id}`} className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-500 hover:text-forest-700">
                <span className="truncate">
                  {eventTitle(latest.event)} · {formatEventDate(latest.event?.event_date)}
                </span>
                <EnquiryStatusBadge status={latest.status} />
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="font-sans text-base font-semibold tracking-normal text-ink-900">Planning an event?</h2>
              <p className="text-sm text-ink-500">Tell us the details and we'll prepare a quotation.</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {latest && (
            <Button to="/account/enquiries" variant="ghost">
              View all
            </Button>
          )}
          <Button to="/account/enquiries/new" variant={latest ? 'secondary' : 'primary'}>
            Plan an event
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

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

        <EnquiryCard userId={profile.id} />

        <Card className="lg:col-start-1">
          <CardBody className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-300/30 text-gold-600">
                <UtensilsCrossed className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-sans text-base font-semibold tracking-normal text-ink-900">Browse our menu</h2>
                <p className="text-sm text-ink-500">See our dishes, prices and dietary information.</p>
              </div>
            </div>
            <Button to="/account/menu" variant="secondary" className="shrink-0">
              View menu
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </CardBody>
        </Card>

        <Card className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
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
