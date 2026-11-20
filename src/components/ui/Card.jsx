import { cn } from '@/utils/cn.js'

export default function Card({ as: Component = 'section', className, children, ...props }) {
  return (
    <Component className={cn('rounded-2xl border border-ivory-200 bg-white/80 shadow-card', className)} {...props}>
      {children}
    </Component>
  )
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-ivory-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6',
        className,
      )}
    >
      <div>
        <h2 className="font-sans text-base font-semibold tracking-normal text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-5 sm:px-6', className)}>{children}</div>
}
