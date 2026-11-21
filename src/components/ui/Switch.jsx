import { cn } from '@/utils/cn.js'

/** Accessible on/off toggle (role="switch"). `label` is required for screen readers. */
export default function Switch({ checked, onChange, label, showLabel = false, disabled, className }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5', disabled && 'cursor-not-allowed opacity-60', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={showLabel ? undefined : label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-forest-700' : 'bg-ivory-300',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
      {showLabel && <span className="text-sm font-medium text-ink-700">{label}</span>}
    </label>
  )
}
