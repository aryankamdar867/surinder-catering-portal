import { Loader2 } from 'lucide-react'

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-500">
        <Loader2 className="size-7 animate-spin text-forest-600" aria-hidden="true" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}
