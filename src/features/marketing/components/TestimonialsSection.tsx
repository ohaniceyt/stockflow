import { Quote } from 'lucide-react'

const testimonials = [
  {
    quote:
      'StockFlow nous a fait gagner 4 heures par semaine sur l’inventaire. Le mode offline est un game-changer pour notre boutique en zone rurale.',
    author: 'Aline K.',
    role: 'Gérante, Boutique Élégance',
  },
  {
    quote:
      'La caisse intégrée et les rôles par équipe nous permettent de former de nouveaux employés en quelques minutes, sans craindre les erreurs.',
    author: 'Marc T.',
    role: 'Directeur, RetailPro Afrique',
  },
  {
    quote:
      'Nous avons testé cinq solutions avant de trouver StockFlow. L’UX est propre, la synchro est fiable et le support réactif.',
    author: 'Sarah N.',
    role: 'COO, Logistique360',
  },
]

export function TestimonialsSection() {
  return (
    <section className="border-y bg-muted/40 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ils gèrent leur stock avec StockFlow
          </h2>
          <p className="mt-2 text-muted-foreground">
            Des équipes de toutes tailles simplifient leur inventaire au quotidien.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <blockquote
              key={i}
              className="rounded-xl border bg-card p-6 shadow-sm transition-transform hover:-translate-y-1"
            >
              <Quote className="mb-4 h-6 w-6 text-primary/60" />
              <p className="mb-4 text-sm leading-relaxed text-foreground">{t.quote}</p>
              <footer className="text-sm">
                <span className="font-semibold">{t.author}</span>
                {t.role && <span className="text-muted-foreground"> — {t.role}</span>}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
