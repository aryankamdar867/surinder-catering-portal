import { cn } from '@/utils/cn.js'

export function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active ? 'border-forest-700 bg-forest-800 text-ivory-50' : 'border-ivory-300 bg-white text-ink-700 hover:border-forest-600',
      )}
    >
      {children}
    </button>
  )
}

/** Single-select chip row with an "All" option. `options` is [[value, label], …]. */
export default function ChipGroup({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{label}</span>
      <FilterChip active={!value} onClick={() => onChange('')}>
        All
      </FilterChip>
      {options.map(([key, text]) => (
        <FilterChip key={key} active={value === key} onClick={() => onChange(value === key ? '' : key)}>
          {text}
        </FilterChip>
      ))}
    </div>
  )
}
