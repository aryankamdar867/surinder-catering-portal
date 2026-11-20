export default function AuthHeading({ title, description }) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-semibold text-forest-900">{title}</h1>
      {description && <p className="mt-2 text-ink-500">{description}</p>}
    </div>
  )
}
