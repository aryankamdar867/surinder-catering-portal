import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/brand/Logo.jsx'

export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-forest-900 p-12 text-ivory-100 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -left-24 top-1/3 size-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 right-0 size-96 rounded-full bg-burgundy-600/25 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--color-gold-300)_1px,transparent_1px)] [background-size:22px_22px]"
        />

        <Logo light className="relative" />

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-300">Your celebration, our kitchen</p>
          <p className="mt-5 font-display text-5xl font-semibold leading-[1.08] text-ivory-50">
            Plan the menu. We&rsquo;ll take care of the rest.
          </p>
          <p className="mt-5 leading-relaxed text-ivory-200/75">
            Build your event menu, send an enquiry and review your quotation, all from one account.
          </p>
        </div>

        <p className="relative text-xs text-ivory-200/50">© {new Date().getFullYear()} Surinder Caterers</p>
      </aside>

      <div className="flex flex-col bg-ivory-50 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink-500 transition hover:bg-ivory-100 hover:text-forest-800"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
