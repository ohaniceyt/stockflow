import { cn } from '@/lib/utils'
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
  realMarginRate: number
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
  realMarginRate,
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
    {
      label: 'TAUX DE MARGE RÉEL',
      value: `${realMarginRate.toLocaleString('fr-FR')}%`,
      raw: realMarginRate,
      icon: TrendingUp,
      isMoney: false,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      barColor: 'bg-emerald-500',
    },
  ]

  const cards = allCards.filter((card) => canViewFinancials || !card.isMoney)

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm"
            data-testid={card.label === 'MOUVEMENTS' ? 'recap-movements-card' : undefined}
          >
            <span className={`absolute left-0 right-0 top-0 h-1 ${card.barColor}`} />
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {card.label}
              </span>
              <span className={cn('rounded-lg p-1.5', card.iconBg, card.iconColor)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground sm:text-3xl truncate">
              {card.isMoney ? card.value : card.value.toLocaleString()}
            </p>
            {'sub' in card && card.sub && (
              <p className="mt-1 text-sm text-muted-foreground truncate">{card.sub}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
