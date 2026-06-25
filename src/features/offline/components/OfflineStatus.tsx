import { cn } from '@/lib/utils'
import { useSync } from '../hooks/useSync'

interface OfflineStatusProps {
  className?: string
}

export function OfflineStatus({ className }: OfflineStatusProps) {
  const { online, isSyncing, lastError, deadCount } = useSync()

  if (online && !isSyncing && !lastError && deadCount === 0) return null

  return (
    <div
      className={cn(
        'fixed right-4 z-50 rounded-full px-4 py-2 text-xs font-medium text-white shadow-lg',
        !online ? 'bg-amber-500' : deadCount > 0 || lastError ? 'bg-red-600' : 'bg-blue-600',
        className ?? 'bottom-4'
      )}
    >
      {!online
        ? 'Mode hors ligne'
        : deadCount > 0
          ? `${String(deadCount)} opération(s) bloquée(s)`
          : lastError
            ? 'Erreur de synchronisation'
            : 'Synchronisation en cours…'}
    </div>
  )
}
