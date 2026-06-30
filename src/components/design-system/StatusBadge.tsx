import { cn } from '@/lib/utils'

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const variants: Record<StatusBadgeVariant, string> = {
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  warning:
    'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  danger:
    'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900',
  info: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900',
  neutral: 'bg-muted text-foreground border-border',
}

export interface StatusBadgeProps {
  children: React.ReactNode
  variant?: StatusBadgeVariant
  className?: string
}

export function StatusBadge({ children, variant = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
