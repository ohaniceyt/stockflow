import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToastContext } from '@/context/toastContext'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        success:
          'border-green-200 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100',
        error: 'border-red-200 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
        warning:
          'border-yellow-200 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type ToastVariant = VariantProps<typeof toastVariants>['variant']

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

let toastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${(++toastId).toString()}`
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  React.useEffect(() => {
    const duration = t.duration ?? 5000
    if (duration <= 0) return undefined
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [t.duration, onDismiss])

  return (
    <div className={cn(toastVariants({ variant: t.variant }))} role="alert" aria-live="polite">
      <div className="flex flex-col gap-1">
        {t.title && <span className="font-semibold">{t.title}</span>}
        {t.description && <span className="text-sm opacity-90">{t.description}</span>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded p-1 text-current opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
        aria-label="Fermer la notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
