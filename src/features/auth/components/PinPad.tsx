import { useState } from 'react'
import { cn } from '@/lib/utils'

interface PinPadProps {
  onSubmit: (pin: string) => void
  onCancel?: () => void
  title?: string
  error?: string | null
  maxLength?: number
  disabled?: boolean
}

export function PinPad({ onSubmit, onCancel, title, error, maxLength = 8, disabled }: PinPadProps) {
  const [pin, setPin] = useState('')

  const handleDigit = (digit: string) => {
    if (disabled) return
    if (pin.length < maxLength) {
      const next = pin + digit
      setPin(next)
      if (next.length >= 4) {
        onSubmit(next)
      }
    }
  }

  const handleBackspace = () => {
    if (disabled) return
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    if (disabled) return
    setPin('')
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0']

  return (
    <div className="w-full max-w-xs">
      {title && <h3 className="mb-4 text-center text-lg font-semibold">{title}</h3>}

      <div className="mb-6 flex justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-12 w-10 items-center justify-center rounded-lg border-2 text-xl font-bold transition-all',
              i < pin.length
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground'
            )}
          >
            {i < pin.length ? '•' : ''}
          </div>
        ))}
      </div>

      {error && <p className="mb-4 text-center text-sm font-medium text-destructive">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        {digits.map((digit, index) =>
          digit ? (
            <button
              key={digit}
              type="button"
              disabled={disabled}
              onClick={() => handleDigit(digit)}
              className={cn(
                'h-14 rounded-xl bg-secondary text-xl font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 active:scale-95',
                disabled && 'opacity-50'
              )}
            >
              {digit}
            </button>
          ) : (
            <div key={`empty-${String(index)}`} />
          )
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={handleBackspace}
          className={cn(
            'h-14 rounded-xl bg-muted text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 active:scale-95',
            disabled && 'opacity-50'
          )}
        >
          ⌫
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="flex-1 rounded-xl border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(disabled) || pin.length < 4}
          onClick={() => onSubmit(pin)}
          className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Valider
        </button>
      </div>

      {pin.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Effacer
        </button>
      )}
    </div>
  )
}
