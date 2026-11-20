import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import { useSignOut } from '@/auth/useSignOut.js'
import Logo from '@/components/brand/Logo.jsx'
import Button from '@/components/ui/Button.jsx'
import { CUSTOMER_NAV } from '@/components/navigation/navigation.js'
import { cn } from '@/utils/cn.js'

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
          isActive ? 'bg-forest-800 text-ivory-50' : 'text-ink-500 hover:bg-ivory-100 hover:text-forest-800',
        )
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

export default function CustomerLayout() {
  const { profile, isAdmin } = useAuth()
  const { signOut, signingOut } = useSignOut()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-ivory-200 bg-ivory-50/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Account" className="hidden items-center gap-1 md:flex">
            {CUSTOMER_NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button to="/admin" variant="secondary" size="sm" className="hidden sm:inline-flex">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Owner portal
              </Button>
            )}
            <span className="hidden max-w-40 truncate text-sm text-ink-500 lg:block">{profile.full_name || profile.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} loading={signingOut} aria-label="Sign out">
              {!signingOut && <LogOut className="size-4" aria-hidden="true" />}
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Account" className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {CUSTOMER_NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {isAdmin && <NavItem to="/admin" label="Owner portal" icon={ShieldCheck} />}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
