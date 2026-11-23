import { ArrowRight, CalendarCheck, ClipboardList, ShieldCheck, Tags, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import RecentNotificationsCard from '@/components/notifications/RecentNotificationsCard.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody } from '@/components/ui/Card.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { useAsync } from '@/hooks/useAsync.js'
import { listAllEnquiries } from '@/services/adminEnquiryService.js'
import { categories, cuisines, listDishes } from '@/services/catalogueService.js'
import { todayInIndia } from '@/utils/dates.js'

async function loadStats() {
  const [dishes, categoryList, cuisineList, enquiries] = await Promise.all([
    listDishes(),
    categories.list(),
    cuisines.list(),
    listAllEnquiries(),
  ])
  const today = todayInIndia()
  const count = (statuses) => enquiries.filter((e) => statuses.includes(e.status)).length
  return {
    newEnquiries: count(['submitted']),
    inReview: count(['under_review']),
    awaiting: count(['quoted']),
    upcoming: enquiries.filter((e) => e.status === 'confirmed' && e.event?.event_date >= today).length,
    dishes: dishes.length,
    available: dishes.filter((d) => d.is_available).length,
    categories: categoryList.length,
    cuisines: cuisineList.length,
  }
}

function StatCard({ icon: Icon, label, value, detail, to, cta }) {
  return (
    <Card>
      <CardBody className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-forest-50 text-forest-700">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-ink-500">{label}</p>
        </div>
        <div>
          <p className="font-display text-5xl font-semibold text-forest-900">{value}</p>
          {detail && <p className="mt-1 text-sm text-ink-500">{detail}</p>}
        </div>
        <Button to={to} variant="ghost" size="sm" className="-ml-3 mt-auto self-start">
          {cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </CardBody>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'there'
  const { data: stats, error } = useAsync(loadStats)
  const show = (n) => (stats ? n : error ? '—' : '…')

  return (
    <>
      <PageHeader eyebrow="Owner portal" title={`Hello, ${firstName}`} description="Manage Surinder Caterers." />

      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard
          icon={ClipboardList}
          label="Enquiries needing action"
          value={show(stats && stats.newEnquiries + stats.inReview)}
          detail={stats && `${stats.newEnquiries} new · ${stats.inReview} in review · ${stats.awaiting} awaiting the customer`}
          to="/admin/enquiries"
          cta="Review enquiries"
        />
        <StatCard
          icon={CalendarCheck}
          label="Upcoming confirmed events"
          value={show(stats?.upcoming)}
          detail={stats && 'Accepted quotations with an event date ahead'}
          to="/admin/enquiries"
          cta="View enquiries"
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Dishes"
          value={show(stats?.dishes)}
          detail={stats && `${stats.available} available to customers`}
          to="/admin/dishes"
          cta="Manage dishes"
        />
        <StatCard
          icon={Tags}
          label="Categories & cuisines"
          value={show(stats && `${stats.categories} / ${stats.cuisines}`)}
          detail={stats && `${stats.categories} categories, ${stats.cuisines} cuisines`}
          to="/admin/catalogue"
          cta="Manage catalogue"
        />
      </div>

      <RecentNotificationsCard allPath="/admin/notifications" className="mt-6" />

      <Card className="mt-6">
        <CardBody className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-500">
            Signed in as <strong className="text-ink-900">{profile.email}</strong> with owner access.
          </p>
        </CardBody>
      </Card>
    </>
  )
}
