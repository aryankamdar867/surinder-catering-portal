import { Check } from 'lucide-react'
import { cn } from '@/utils/cn.js'

/** Progress through the wizard. Completed steps are clickable to go back. */
export default function StepIndicator({ steps, current, onSelect }) {
  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Enquiry steps">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step.key} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!done}
              onClick={() => onSelect(index)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition',
                active && 'bg-forest-800 text-ivory-50',
                done && 'text-forest-800 hover:bg-forest-50',
                !active && !done && 'text-ink-400',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-xs font-semibold',
                  active ? 'bg-ivory-50 text-forest-800' : done ? 'bg-forest-100 text-forest-800' : 'bg-ivory-200 text-ink-500',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              {step.title}
              {done && <span className="sr-only">(completed)</span>}
            </button>
            {index < steps.length - 1 && <span className="h-px w-4 bg-ivory-300 sm:w-8" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
