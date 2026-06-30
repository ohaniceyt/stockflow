import { useState, useMemo } from 'react'

const RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  XOF: 655.957,
}

const SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  XOF: 'F CFA',
}

export function usePricingCurrency() {
  const [currency, setCurrency] = useState('EUR')

  const format = useMemo(() => {
    return (cents: number, fractionDigits = 0) => {
      const value = (cents / 100) * RATES[currency]
      const symbol = SYMBOLS[currency]
      if (currency === 'XOF') {
        return `${Math.round(value).toLocaleString('fr-FR')} ${symbol}`
      }
      return `${value.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })} ${symbol}`
    }
  }, [currency])

  return { currency, setCurrency, currencies: Object.keys(RATES), format }
}
