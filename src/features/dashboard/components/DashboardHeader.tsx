import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/design-system'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  onRefresh: () => void
  isRefreshing: boolean
}

export function DashboardHeader({ onRefresh, isRefreshing }: DashboardHeaderProps) {
  return (
    <PageHeader
      title="Tableau de bord"
      description="Vue d'ensemble de votre stock et de votre activité."
      actions={
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      }
    />
  )
}
