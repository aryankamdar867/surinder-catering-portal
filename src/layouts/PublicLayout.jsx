import { Outlet } from 'react-router-dom'
import Logo from '@/components/brand/Logo.jsx'

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ivory-200/80 bg-ivory-50/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          {/* Sign in / Register links are added with authentication in Phase 3. */}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-forest-900 text-ivory-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo light />
          <p className="text-sm text-ivory-200/70">
            © {new Date().getFullYear()} Surinder Caterers. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
