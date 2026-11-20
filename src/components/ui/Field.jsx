import { useId } from 'react'
import { cn } from '@/utils/cn.js'

const base =
  'block w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 ' +
  'transition focus:outline-none focus-visible:outline-none focus:ring-4 ' +
  'disabled:cursor-not-allowed disabled:bg-ivory-100 disabled:text-ink-500'

/**
 * Labelled input with hint and error text, wired up for screen readers.
 * Pass `as="textarea"` for multi-line input and `trailing` for an inline action.
 */
export default function Field({
  label,
  hint,
  error,
  optional = false,
  as: Control = 'input',
  id,
  trailing,
  className,
  inputClassName,
  ...props
}) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">
        {label}
        {optional && <span className="font-normal text-ink-400"> (optional)</span>}
      </label>
      <div className="relative">
        <Control
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          className={cn(
            base,
            error
              ? 'border-burgundy-500 focus:border-burgundy-500 focus:ring-burgundy-500/10'
              : 'border-ivory-300 focus:border-forest-600 focus:ring-forest-600/10',
            Control === 'textarea' && 'min-h-24 resize-y',
            trailing && 'pr-12',
            inputClassName,
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>}
      </div>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-burgundy-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-ink-400">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
