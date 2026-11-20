import { CalendarHeart, ChefHat, FileText } from 'lucide-react'

const pillars = [
  {
    icon: CalendarHeart,
    title: 'Every occasion',
    text: 'Weddings, receptions, engagements, birthdays and corporate events, planned around your guests.',
  },
  {
    icon: ChefHat,
    title: 'Menus built for you',
    text: 'Choose from our live dish catalogue and shape a menu that fits your cuisine, diet and budget.',
  },
  {
    icon: FileText,
    title: 'Clear quotations',
    text: 'Transparent, itemised quotations you can review and respond to from your own portal.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold-300/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.28em] text-burgundy-600">
            Catering for celebrations
          </p>
          <h1 className="animate-fade-up mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-forest-900 [animation-delay:80ms] sm:text-7xl">
            Food your guests will remember.
          </h1>
          <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-ink-500 [animation-delay:160ms]">
            Plan your event menu, send an enquiry and receive a detailed quotation from Surinder Caterers, all in
            one place.
          </p>
        </div>
      </section>

      <section className="border-t border-ivory-200 bg-ivory-100/60">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-ivory-200 bg-ivory-50 p-7 shadow-card">
              <span className="grid size-11 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold text-forest-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
