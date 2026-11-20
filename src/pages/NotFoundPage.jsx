import Button from '@/components/ui/Button.jsx'

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="font-display text-7xl font-semibold text-gold-500">404</p>
      <h1 className="mt-4 text-3xl font-semibold text-forest-900">This page isn&rsquo;t on the menu</h1>
      <p className="mt-3 text-ink-500">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Button to="/" className="mt-8">
        Back to home
      </Button>
    </section>
  )
}
