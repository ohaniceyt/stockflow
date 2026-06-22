import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStock, recordMovement } from '../services/stockService'

const STOCK_QUERY_KEY = 'stock'

export function useStock() {
  return useQuery({
    queryKey: [STOCK_QUERY_KEY],
    queryFn: fetchStock,
    staleTime: 30 * 1000,
  })
}

export function useRecordMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordMovement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
    },
  })
}
