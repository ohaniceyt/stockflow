import {
  ArrowLeftRight,
  Warehouse,
  Banknote,
  Coins,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react'

interface RecapStatsProps {
  totalQuantity: number
  stockValue: number
  stockSellingValue: number
  estimatedRevenue: number
  estimatedMargin: number
  realRevenue: number
  realProfit: number
  inCount: number
  outCount: number
  currency: string
  canViewFinancials?: boolean
}

export function RecapStats({
  totalQuantity,
  stockValue,
  stockSellingValue,
  estimatedRevenue,
  estimatedMargin,
  realRevenue,
  realProfit,
  inCount,
  outCount,
  currency,
  canViewFinancials = true,
}: RecapStatsProps) {
  const formatMoney = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const allCards = [
    {
      label: 'MOUVEMENTS',
      value: `${inCount.toLocaleString()} / ${outCount.toLocaleString()}`,
      raw: inCount + outCount,
      icon: ArrowLeftRight,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      barColor: 'bg-sky-400',
      isMoney: false,
      sub: `${String(inCount)} entrées · ${String(outCount)} sorties`,
    },
    {
      label: 'QTÉ TOTALE EN STOCK',
      value: totalQuantity,
      icon: Warehouse,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      barColor: 'bg-amber-400',
      isMoney: false,
    },
    {
      label: `VALEUR STOCK (${currency})`,
      value: formatMoney(stockValue),
      raw: stockValue,
      icon: Coins,
      isMoney: true,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
      barColor: 'bg-violet-400',
    },
    {
      label: `VALEUR VENTE STOCK (${currency})`,
      value: formatMoney(stockSellingValue),
      raw: stockSellingValue,
      icon: Banknote,
      isMoney: true,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      barColor: 'bg-indigo-400',
    },
    {
      label: `CA ESTIMÉ (${currency})`,
      value: formatMoney(estimatedRevenue),
      raw: estimatedRevenue,
      icon: Banknote,
      isMoney: true,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
      barColor: 'bg-teal-400',
    },
    {
      label: `MARGE PRÉVUE (${currency})`,
      value: formatMoney(estimatedMargin),
      raw: estimatedMargin,
      icon: PiggyBank,
      isMoney: true,
      iconColor: 'text-fuchsia-600',
      iconBg: 'bg-fuchsia-50',
      barColor: 'bg-fuchsia-400',
    },
    {
      label: `CA RÉEL (${currency})`,
      value: formatMoney(realRevenue),
      raw: realRevenue,
      icon: Wallet,
      isMoney: true,
      iconColor: 'text-teal-700',
      iconBg: 'bg-teal-100',
      barColor: 'bg-teal-500',
    },
    {
      label: `BÉNÉFICE RÉALISÉ (${currency})`,
      value: formatMoney(realProfit),
      raw: realProfit,
      icon: TrendingUp,
      isMoney: true,
      iconColor: 'text-fuchsia-700',
      iconBg: 'bg-fuchsia-100',
      barColor: 'bg-fuchsia-500',
    },
  ]

  const cards = allCards.filter((card) => canViewFinancials || !card.isMoney)

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="sc"
          data-testid={card.label === 'MOUVEMENTS' ? 'recap-movements-card' : undefined}
        >
          <div className={`sc-bar ${card.barColor}`} />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-faint)] truncate">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-h)] truncate">
                {card.isMoney ? card.value : card.value.toLocaleString()}
              </p>
              {'sub' in card && card.sub && (
                <p className="mt-1 text-[10px] text-[var(--text-faint)] truncate">{card.sub}</p>
              )}
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
