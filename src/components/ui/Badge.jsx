import { cn } from '@/utils/cn.js'

const tones = {
  neutral: 'bg-ivory-100 text-ink-700 border-ivory-200',
  forest: 'bg-forest-50 text-forest-700 border-forest-100',
  burgundy: 'bg-burgundy-50 text-burgundy-700 border-burgundy-500/20',
  gold: 'bg-gold-300/30 text-gold-600 border-gold-300',
}

export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
