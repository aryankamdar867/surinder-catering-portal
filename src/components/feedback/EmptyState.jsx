import { cn } from '@/utils/cn.js'

export default function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-ivory-300 px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-forest-50 text-forest-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <h2 className="mt-4 text-2xl font-semibold text-forest-900">{title}</h2>
      {message && <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
