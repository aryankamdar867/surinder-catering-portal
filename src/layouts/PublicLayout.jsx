import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import Logo from '@/components/brand/Logo.jsx'
import Button from '@/components/ui/Button.jsx'

function HeaderActions() {
  const { loading, user, isAdmin } = useAuth()
  if (loading) return null
  if (user) {
    return (
      <Button to={isAdmin ? '/admin' : '/account'} size="sm">
        {isAdmin ? 'Owner portal' : 'My account'}
      </Button>
    )
  }
  return (
    <nav aria-label="Sign in" className="flex items-center gap-1 sm:gap-2">
      <Button to="/login" variant="ghost" size="sm" className="px-2.5 sm:px-3.5">
        <UserRound className="hidden size-4 sm:block" aria-hidden="true" />
        Customer login
      </Button>
      <Button to="/admin/login" variant="secondary" size="sm" className="px-2.5 sm:px-3.5">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Admin login
      </Button>
      <Button to="/register" size="sm" className="hidden md:inline-flex">
        Create account
      </Button>
    </nav>
  )
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ivory-200/80 bg-ivory-50/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
          <Logo compact />
          <HeaderActions />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-forest-900 text-ivory-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo light />
          <div className="flex flex-col gap-3 sm:items-end">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link to="/login" className="text-ivory-200/80 hover:text-ivory-50">
                Customer login
              </Link>
              <Link to="/admin/login" className="inline-flex items-center gap-1.5 text-ivory-200/80 hover:text-ivory-50">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Admin login
              </Link>
            </nav>
            <p className="text-sm text-ivory-200/70">
              © {new Date().getFullYear()} Surinder Caterers. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
