import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import Card, { CardBody } from '@/components/ui/Card.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'there'

  return (
    <>
      <PageHeader eyebrow="Owner portal" title={`Hello, ${firstName}`} description="Manage Surinder Caterers." />
      <Card>
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
