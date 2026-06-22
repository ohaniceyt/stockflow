import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMovement, fetchMovements } from '../services/movementService'

const MOVEMENTS_QUERY_KEY = 'movements'

export function useMovements() {
  return useQuery({
    queryKey: [MOVEMENTS_QUERY_KEY],
    queryFn: fetchMovements,
    staleTime: 30 * 1000,
  })
}

export function useCreateMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createMovement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MOVEMENTS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}
