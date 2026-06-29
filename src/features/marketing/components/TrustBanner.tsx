import { ShieldCheck, Clock, Globe, BarChart3, Smartphone, Lock } from 'lucide-react'

const trustItems = [
  { icon: ShieldCheck, label: 'Sécurité bancaire' },
  { icon: Clock, label: 'Disponible 24/7' },
  { icon: Globe, label: 'Multi-devises' },
  { icon: BarChart3, label: 'Rapports temps réel' },
  { icon: Smartphone, label: 'Mobile-first' },
  { icon: Lock, label: 'Conforme RGPD' },
]

export function TrustBanner() {
  return (
    <section className="border-y bg-muted/30 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-6 text-center text-base font-medium uppercase tracking-wider text-muted-foreground">
          Conçu pour les PME ambitieuses
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {trustItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                <Icon className="h-6 w-6 text-primary" />
                <span className="text-base font-medium">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
