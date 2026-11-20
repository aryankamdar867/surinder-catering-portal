import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn.js'

export default function Logo({ className, light = false }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-3', className)} aria-label="Surinder Caterers home">
      <span
        className={cn(
          'grid size-10 place-items-center rounded-xl font-display text-lg font-semibold',
          light ? 'bg-ivory-50 text-forest-800' : 'bg-forest-800 text-gold-300',
        )}
      >
        SC
      </span>
      <span className="leading-none">
        <span className={cn('block font-display text-xl font-semibold', light ? 'text-ivory-50' : 'text-forest-900')}>
          Surinder Caterers
        </span>
        <span
          className={cn(
            'mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.22em]',
            light ? 'text-gold-300' : 'text-gold-600',
          )}
        >
          Fine catering
        </span>
      </span>
    </Link>
  )
}
