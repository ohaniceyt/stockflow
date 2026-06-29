import { Unlock, Lock, History } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CashierSession } from '@/types'

interface SessionDrawerProps {
  open: boolean
  onClose: () => void
  openSession: CashierSession | null
  sessionRevenue: number
  sessionSales: {
    id: string
    createdAt: string
    quantity: number
    unitPrice: number | null
    productName?: string
  }[]
  openingBalanceInput: string
  closingBalanceInput: string
  openingPending: boolean
  closingPending: boolean
  canCancelSales: boolean
  formatCurrency: (value: number) => string
  formatDateTime: (value: string) => string
  onOpeningBalanceChange: (value: string) => void
  onClosingBalanceChange: (value: string) => void
  onOpenSession: () => void
  onCloseSession: () => void
  onCancelSale: (movementId: string) => void
}

export function SessionDrawer({
  open,
  onClose,
  openSession,
  sessionRevenue,
  sessionSales,
  openingBalanceInput,
  closingBalanceInput,
  openingPending,
  closingPending,
  canCancelSales,
  formatCurrency,
  formatDateTime,
  onOpeningBalanceChange,
  onClosingBalanceChange,
  onOpenSession,
  onCloseSession,
  onCancelSale,
}: SessionDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session de caisse</DialogTitle>
          <DialogDescription>
            Gérez l’ouverture, la clôture et l’historique des ventes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {openSession ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">Caisse ouverte</p>
                  <p className="text-sm text-muted-foreground">
                    Solde d’ouverture : {formatCurrency(openSession.openingBalance)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recette en cours : {formatCurrency(sessionRevenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Solde théorique : {formatCurrency(openSession.openingBalance + sessionRevenue)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="Solde de clôture"
                  value={closingBalanceInput}
                  onChange={(e) => onClosingBalanceChange(e.target.value)}
                />
                {closingBalanceInput !== '' && (
                  <p className="text-sm">
                    Écart :{' '}
                    {formatCurrency(
                      Number(closingBalanceInput) - (openSession.openingBalance + sessionRevenue)
                    )}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={closingBalanceInput === '' || closingPending}
                  onClick={onCloseSession}
                >
                  {closingPending ? 'Clôture…' : 'Clôturer la caisse'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-start gap-3">
                <Unlock className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">Caisse fermée</p>
                  <p className="text-sm text-muted-foreground">
                    Aucune caisse n’est ouverte pour cet emplacement.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="Solde d’ouverture"
                  value={openingBalanceInput}
                  onChange={(e) => onOpeningBalanceChange(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={openingPending || openingBalanceInput === ''}
                  onClick={onOpenSession}
                >
                  {openingPending ? 'Ouverture…' : 'Ouvrir'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> Historique de la session
            </h3>
            {sessionSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur cette session.</p>
            ) : (
              <ul className="space-y-2">
                {sessionSales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{sale.productName ?? 'Produit'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(sale.createdAt)} — {sale.quantity} x{' '}
                        {formatCurrency(sale.unitPrice ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatCurrency((sale.unitPrice ?? 0) * sale.quantity)}
                      </span>
                      {canCancelSales && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => onCancelSale(sale.id)}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
