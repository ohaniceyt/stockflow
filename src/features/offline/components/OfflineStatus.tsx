import { useSync } from '../hooks/useSync'

export function OfflineStatus() {
  const { online, isSyncing } = useSync()

  if (online && !isSyncing) return null

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 text-xs font-medium shadow-lg ${
        online ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      {online ? 'Synchronisation en cours…' : 'Mode hors ligne'}
    </div>
  )
}
