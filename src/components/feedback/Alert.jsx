import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/utils/cn.js'

const tones = {
  info: { icon: Info, className: 'border-forest-100 bg-forest-50 text-forest-800' },
  success: { icon: CheckCircle2, className: 'border-forest-100 bg-forest-50 text-forest-800' },
  warning: { icon: TriangleAlert, className: 'border-gold-300 bg-gold-300/20 text-ink-700' },
  error: { icon: AlertCircle, className: 'border-burgundy-500/20 bg-burgundy-50 text-burgundy-700' },
}

export default function Alert({ tone = 'info', title, children, className }) {
  const { icon: Icon, className: toneClass } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}
