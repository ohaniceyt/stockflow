import { useMemo } from 'react'
import { useMovements } from '@/features/movements/hooks/useMovements'

export function useFirstSale() {
  const { data: movements, isLoading } = useMovements()

  const hasSales = useMemo(() => {
    return movements.some((m) => m.type === 'OUT' && !!m.cashierSessionId && !m.isCancelled)
  }, [movements])

  return {
    isLoading,
    isFirstSale: !isLoading && !hasSales,
  }
}
