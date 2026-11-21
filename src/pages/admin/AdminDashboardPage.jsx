import { ArrowRight, ShieldCheck, Tags, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody } from '@/components/ui/Card.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { useAsync } from '@/hooks/useAsync.js'
import { categories, cuisines, listDishes } from '@/services/catalogueService.js'

async function loadStats() {
  const [dishes, categoryList, cuisineList] = await Promise.all([listDishes(), categories.list(), cuisines.list()])
  return {
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
