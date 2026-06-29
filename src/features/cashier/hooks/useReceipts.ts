import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReceipt,
  getReceiptsBySession,
  getReceiptWithOrg,
  type CreateReceiptInput,
} from '@/features/cashier/services/receiptService'

const receiptsKey = (sessionId: string) => ['receipts', 'session', sessionId]
const receiptKey = (receiptId: string) => ['receipt', receiptId]

export function useReceiptsBySession(sessionId: string | undefined) {
  return useQuery({
    queryKey: receiptsKey(sessionId ?? ''),
    queryFn: () => {
      if (!sessionId) throw new Error('sessionId is required')
      return getReceiptsBySession(sessionId)
    },
    enabled: Boolean(sessionId),
  })
}

export function useReceiptWithOrg(receiptId: string | undefined) {
  return useQuery({
    queryKey: receiptKey(receiptId ?? ''),
    queryFn: () => {
      if (!receiptId) throw new Error('receiptId is required')
      return getReceiptWithOrg(receiptId)
    },
    enabled: Boolean(receiptId),
  })
}

export function useCreateReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateReceiptInput) => createReceipt(input),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({
        queryKey: receiptsKey(receipt.cashierSessionId ?? ''),
      })
    },
  })
}
