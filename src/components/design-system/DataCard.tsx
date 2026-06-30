import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type DataCardStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const statusClasses: Record<DataCardStatus, { bg: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    bg: 'bg-rose-50 dark:bg-rose-950',
    text: 'text-rose-700 dark:text-rose-300',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  info: {
    bg: 'bg-indigo-50 dark:bg-indigo-950',
    text: 'text-indigo-700 dark:text-indigo-300',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  neutral: { bg: 'bg-muted', text: 'text-foreground', icon: 'text-muted-foreground' },
}

export interface DataCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  status?: DataCardStatus
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function DataCard({
  label,
  value,
  subtitle,
  icon: Icon,
  status = 'neutral',
  trend,
  className,
}: DataCardProps) {
  const statusStyle = statusClasses[status]

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-transform active:scale-[0.98]',
        className
      )}
    >
      <span
        className={cn(
          'absolute left-0 right-0 top-0 h-1',
          status === 'success' && 'bg-emerald-500',
          status === 'warning' && 'bg-amber-500',
          status === 'danger' && 'bg-rose-500',
          status === 'info' && 'bg-indigo-500',
          status === 'neutral' && 'bg-border'
        )}
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className={cn('rounded-lg p-1.5', statusStyle.bg, statusStyle.icon)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-foreground sm:text-3xl">{value}</p>

      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-sm">
          <span
            className={cn(
              'font-medium',
              trend.value > 0
                ? 'text-emerald-600'
                : trend.value < 0
                  ? 'text-rose-600'
                  : 'text-muted-foreground'
            )}
          >
            {trend.value > 0 ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
