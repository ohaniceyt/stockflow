import { RefreshCw } from 'lucide-react'

interface DashboardHeaderProps {
  onRefresh: () => void
  isRefreshing: boolean
}

export function DashboardHeader({ onRefresh, isRefreshing }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-h)] sm:text-2xl">Tableau de bord</h1>
        <p className="text-base text-[var(--text-faint)]">Vue d'ensemble de votre stock.</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="btn-o btn-ic shrink-0"
        aria-label="Rafraîchir"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
