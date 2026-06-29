import { Star } from 'lucide-react'

const logos = [
  { name: 'Boutique Alima', initials: 'BA' },
  { name: 'Électro Dakar', initials: 'ED' },
  { name: 'Maison Kofi', initials: 'MK' },
  { name: 'Pharmacie du Centre', initials: 'PC' },
  { name: 'Supermarché Étoile', initials: 'SE' },
  { name: 'TexStyle Abidjan', initials: 'TA' },
]

const testimonials = [
  {
    quote:
      'Avant StockFlow, je perdais des heures sur Excel. Aujourd’hui je sais exactement ce qui me reste en stock et je vends plus vite en caisse.',
    author: 'Aïcha Diallo',
    role: 'Gérante, Boutique Alima',
    location: 'Dakar',
  },
  {
    quote:
      'Le mode offline nous a sauvé la vie. Même quand la connexion est instable, on continue à vendre et à facturer.',
    author: 'Koffi Mensah',
    role: 'Responsable magasin, Électro Dakar',
    location: 'Abidjan',
  },
]

export function SocialProof() {
  return (
    <section className="border-y bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-base font-medium uppercase tracking-wider text-muted-foreground">
            Ils gagnent du temps chaque jour
          </p>
          <div className="mt-4 flex items-center justify-center gap-1 text-base font-medium">
            <span className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
            </span>
            <span className="ml-2 text-muted-foreground">
              Note moyenne 4.8/5 sur plus de 120 avis
            </span>
          </div>
        </div>

        <div className="mb-16 grid grid-cols-3 gap-6 md:grid-cols-6">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-bold">
                {logo.initials}
              </div>
              <span className="text-center text-base font-medium">{logo.name}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((t) => (
            <div key={t.author} className="rounded-2xl border bg-background p-6 shadow-sm">
              <div className="mb-4 flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <blockquote className="mb-4 text-foreground">“{t.quote}”</blockquote>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                  {t.author
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="text-base font-semibold">{t.author}</p>
                  <p className="text-base text-muted-foreground">
                    {t.role} — {t.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
