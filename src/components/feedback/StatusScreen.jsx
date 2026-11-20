import { cn } from '@/utils/cn.js'

/** Centered full-area message used for errors, access denied, etc. */
export default function StatusScreen({ icon: Icon, tone = 'neutral', title, message, actions, className }) {
  return (
    <div className={cn('grid min-h-[60dvh] place-items-center px-4', className)}>
      <div className="max-w-md text-center">
        {Icon && (
          <span
            className={cn(
              'mx-auto grid size-14 place-items-center rounded-2xl',
              tone === 'error' ? 'bg-burgundy-50 text-burgundy-600' : 'bg-forest-50 text-forest-700',
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
        )}
        <h1 className="mt-5 text-3xl font-semibold text-forest-900">{title}</h1>
        {message && <p className="mt-2 text-ink-500">{message}</p>}
        {actions && <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
