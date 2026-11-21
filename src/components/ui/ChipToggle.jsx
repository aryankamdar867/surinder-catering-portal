import { Check } from 'lucide-react'
import { cn } from '@/utils/cn.js'

/** A checkbox styled as a pill. Used for multi-select options and filters. */
export default function ChipToggle({ checked, onChange, disabled, children, className, ...props }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-600',
        checked
          ? 'border-forest-700 bg-forest-800 text-ivory-50'
          : 'border-ivory-300 bg-white text-ink-700 hover:border-forest-600',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        {...props}
      />
      {checked && <Check className="size-3.5" aria-hidden="true" />}
      {children}
    </label>
  )
}
