import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'

export function SudoBanner() {
  const { sudoTarget, exitSudo, platformAdminRole } = useAuth()

  if (!sudoTarget) return null

  return (
    <div
      data-testid="sudo-banner"
      className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Sudo actif : <span className="font-semibold">{sudoTarget.name}</span>{' '}
          {platformAdminRole && <span className="text-sm">({platformAdminRole})</span>}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={() => void exitSudo()}>
        Quitter le sudo
      </Button>
    </div>
  )
}
