import { ShoppingCart, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CashierHeaderProps {
  orgName: string
  locationName: string
  cartCount: number
  onOpenSession: () => void
}

export function CashierHeader({
  orgName,
  locationName,
  cartCount,
  onOpenSession,
}: CashierHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Caisse</h1>
        <p className="text-sm text-muted-foreground">
          {orgName} — {locationName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{cartCount} article(s)</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenSession}>
          <Menu className="mr-2 h-4 w-4" />
          Session
        </Button>
      </div>
    </div>
  )
}
