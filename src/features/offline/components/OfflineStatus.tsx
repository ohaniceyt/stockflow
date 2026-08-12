import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useSync } from '../hooks/useSync'

interface OfflineStatusProps {
  className?: string
  onRetry?: () => void
}

export function OfflineStatus({ className, onRetry }: OfflineStatusProps) {
  const { online, isSyncing, lastError, deadCount, retryDead } = useSync()
  const navigate = useNavigate()

  if (online && !isSyncing && !lastError && deadCount === 0) return null

  return (
    <div
      className={cn(
        'fixed left-4 right-auto z-50 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg md:right-4 md:left-auto',
        !online ? 'bg-amber-500' : deadCount > 0 || lastError ? 'bg-red-600' : 'bg-blue-600',
        className ?? 'bottom-20 md:bottom-4'
      )}
    >
      <span>
        {!online
          ? 'Mode hors ligne'
          : deadCount > 0
            ? `${String(deadCount)} opération(s) bloquée(s)`
            : lastError
              ? 'Erreur de synchronisation'
              : 'Synchronisation en cours…'}
      </span>
      {online && deadCount > 0 && !isSyncing && (
        <>
          <button
            type="button"
            onClick={() => {
              void retryDead()
              onRetry?.()
            }}
            className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings/sync-queue')}
            className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            Gérer
          </button>
        </>
      )}
    </div>
  )
}
