import * as React from 'react'
import type { Toast } from '@/components/ui/toast'

interface ToastContextValue {
  toasts: Toast[]
  toast: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)
