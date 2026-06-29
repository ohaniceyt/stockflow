import { useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { CartItem } from '../pages/CashierPage'

interface CartPanelProps {
  cart: CartItem[]
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  amountPaid: string
  note: string
  subtotal: number
  taxAmount: number
  total: number
  taxRate: number
  taxName?: string | null
  isCheckingOut: boolean
  openSession: boolean
  success: boolean
  onPaymentMethodChange: (method: 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other') => void
  onAmountPaidChange: (value: string) => void
  onNoteChange: (value: string) => void
  onUpdateQuantity: (itemId: string, delta: number) => void
  onUpdatePrice: (itemId: string, price: number) => void
  onRemove: (itemId: string) => void
  onCheckout: () => void
  formatCurrency: (value: number) => string
}

export function CartPanel({
  cart,
  paymentMethod,
  amountPaid,
  note,
  subtotal,
  taxAmount,
  total,
  taxRate,
  taxName,
  isCheckingOut,
  openSession,
  success,
  onPaymentMethodChange,
  onAmountPaidChange,
  onNoteChange,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onCheckout,
  formatCurrency,
}: CartPanelProps) {
  const [showNote, setShowNote] = useState(note.length > 0)

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Panier</h2>

      {cart.length === 0 ? (
        <p className="text-sm text-muted-foreground">Le panier est vide.</p>
      ) : (
        <ul className="space-y-3">
          {cart.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">{item.locationName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={item.sellingPrice}
                  onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                  className="h-8 w-28"
                />
              </div>
              <p className="mt-2 text-right text-sm font-medium">
                {formatCurrency(item.sellingPrice * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t pt-4">
        <div className="space-y-1">
          <Label htmlFor="payment-method">Mode de paiement</Label>
          <Select
            id="payment-method"
            value={paymentMethod}
            onChange={(e) =>
              onPaymentMethodChange(
                e.target.value as 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
              )
            }
          >
            <option value="cash">Espèces</option>
            <option value="card">Carte bancaire</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="transfer">Virement</option>
            <option value="other">Autre</option>
          </Select>
        </div>

        {paymentMethod === 'cash' && (
          <div className="space-y-1">
            <Label htmlFor="amount-paid">Montant reçu</Label>
            <Input
              id="amount-paid"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amountPaid}
              onChange={(e) => onAmountPaidChange(e.target.value)}
              placeholder={`Minimum ${formatCurrency(total)}`}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowNote((prev) => !prev)}
          className="text-sm text-muted-foreground underline"
        >
          {showNote ? 'Masquer la note' : 'Ajouter une note'}
        </button>
        {showNote && (
          <Input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Référence, remise…"
          />
        )}

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {taxName ?? 'Taxe'} ({taxRate}%)
              </span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {paymentMethod === 'cash' && Number(amountPaid) >= total && (
            <div className="flex items-center justify-between text-green-600">
              <span>Monnaie</span>
              <span>{formatCurrency(Number(amountPaid) - total)}</span>
            </div>
          )}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={
            cart.length === 0 ||
            isCheckingOut ||
            !openSession ||
            (paymentMethod === 'cash' && Number(amountPaid) < total)
          }
          onClick={onCheckout}
        >
          {isCheckingOut ? 'Enregistrement…' : 'Valider la vente'}
        </Button>
        {!openSession && (
          <p className="text-center text-sm text-destructive">
            Ouvrez une caisse pour valider une vente.
          </p>
        )}
        {success && <p className="text-center text-sm text-green-600">Vente enregistrée.</p>}
      </div>
    </div>
  )
}
