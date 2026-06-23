import { cn } from '@/lib/utils'
import { useSync } from '../hooks/useSync'

interface OfflineStatusProps {
  className?: string
}

export function OfflineStatus({ className }: OfflineStatusProps) {
  const { online, isSyncing } = useSync()

  if (online && !isSyncing) return null

  return (
    <div
      className={cn(
        'fixed right-4 z-50 rounded-full px-4 py-2 text-xs font-medium text-white shadow-lg',
        online ? 'bg-blue-600' : 'bg-amber-500',
        className ?? 'bottom-4'
      )}
    >
      {online ? 'Synchronisation en cours…' : 'Mode hors ligne'}
    </div>
  )
}
