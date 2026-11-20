import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn.js'

const variants = {
  primary: 'bg-forest-800 text-ivory-50 hover:bg-forest-700 shadow-sm',
  secondary: 'bg-ivory-50 text-forest-800 border border-ivory-300 hover:border-forest-600 hover:bg-white',
  accent: 'bg-burgundy-600 text-ivory-50 hover:bg-burgundy-700 shadow-sm',
  ghost: 'text-forest-800 hover:bg-forest-50',
  danger: 'bg-burgundy-50 text-burgundy-700 hover:bg-burgundy-600 hover:text-ivory-50',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
}

/**
 * Shared button. Renders a <Link> when `to` is given, otherwise a <button>.
 */
export default function Button({
  as,
  to,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-wide',
    'transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )

  const content = (
    <>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  const Component = as ?? 'button'
  return (
    <Component className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </Component>
  )
}
