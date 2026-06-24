import {
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Warehouse,
  Banknote,
  Coins,
  PiggyBank,
} from 'lucide-react'

interface RecapStatsProps {
  productCount: number
  totalQuantity: number
  stockValue: number
  stockSellingValue: number
  revenue: number
  generatedMargin: number
  inCount: number
  outCount: number
  currency: string
}

export function RecapStats({
  productCount,
  totalQuantity,
  stockValue,
  stockSellingValue,
  revenue,
  generatedMargin,
  inCount,
  outCount,
  currency,
}: RecapStatsProps) {
  const formatMoney = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const cards = [
    {
      label: 'Entrées',
      value: inCount,
      icon: ArrowDownLeft,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      barColor: 'bg-emerald-400',
    },
    {
      label: 'Sorties',
      value: outCount,
      icon: ArrowUpRight,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      barColor: 'bg-rose-400',
    },
    {
      label: 'Produits actifs',
      value: productCount,
      icon: Package,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      barColor: 'bg-sky-400',
    },
    {
      label: 'Qté totale en stock',
      value: totalQuantity,
      icon: Warehouse,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      barColor: 'bg-amber-400',
    },
    {
      label: `Valeur du stock (${currency})`,
      value: formatMoney(stockValue),
      raw: stockValue,
      icon: Coins,
      isMoney: true,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
      barColor: 'bg-violet-400',
    },
    {
      label: `Valeur vente stock (${currency})`,
      value: formatMoney(stockSellingValue),
      raw: stockSellingValue,
      icon: Banknote,
      isMoney: true,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      barColor: 'bg-indigo-400',
    },
    {
      label: `Chiffre d'affaires (${currency})`,
      value: formatMoney(revenue),
      raw: revenue,
      icon: Banknote,
      isMoney: true,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
      barColor: 'bg-teal-400',
    },
    {
      label: `Marge générée (${currency})`,
      value: formatMoney(generatedMargin),
      raw: generatedMargin,
      icon: PiggyBank,
      isMoney: true,
      iconColor: 'text-fuchsia-600',
      iconBg: 'bg-fuchsia-50',
      barColor: 'bg-fuchsia-400',
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="sc">
          <div className={`sc-bar ${card.barColor}`} />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-faint)] truncate">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-h)] truncate">
                {card.isMoney ? card.value : card.value.toLocaleString()}
              </p>
            </div>
            <div className={`rounded-lg ${card.iconBg} p-2 shrink-0`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
