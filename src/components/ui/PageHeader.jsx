export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-burgundy-600">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-4xl font-semibold text-forest-900 sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}
