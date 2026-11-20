import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, UserRound, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import { useSignOut } from '@/auth/useSignOut.js'
import Logo from '@/components/brand/Logo.jsx'
import { ADMIN_NAV } from '@/components/navigation/navigation.js'
import { cn } from '@/utils/cn.js'

const linkClass = ({ isActive }) =>
  cn(
    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
    isActive ? 'bg-ivory-50 text-forest-900' : 'text-ivory-200/80 hover:bg-white/10 hover:text-ivory-50',
  )

function SidebarContent({ onNavigate }) {
  const { profile } = useAuth()
  const { signOut, signingOut } = useSignOut()

  return (
    <div className="flex h-full flex-col">
      <div>
        <Logo light />
        <span className="mt-4 inline-block rounded-full border border-gold-300/40 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-300">
          Owner portal
        </span>
      </div>

      <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
        {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass} onClick={onNavigate}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/10 pt-5">
        <p className="truncate px-3.5 pb-2 text-xs text-ivory-200/60">{profile.email}</p>
        <NavLink to="/account/profile" className={linkClass} onClick={onNavigate}>
          <UserRound className="size-4" aria-hidden="true" />
          My profile
        </NavLink>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ivory-200/80 transition hover:bg-white/10 hover:text-ivory-50 disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-ivory-50 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh bg-forest-900 p-6 lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-forest-900 px-4 lg:hidden">
          <Logo light />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-xl text-ivory-50 hover:bg-white/10"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              className="absolute inset-0 bg-ink-900/50"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="relative h-full w-72 max-w-[85vw] bg-forest-900 p-6">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-ivory-50 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
