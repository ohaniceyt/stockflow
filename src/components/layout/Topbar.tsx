import { Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

interface TopbarProps {
  onMenuOpen: () => void
  className?: string
}

export function Topbar({ onMenuOpen, className }: TopbarProps) {
  const { session } = useAuth()
  const roleLabel = session?.membership.role === 'super_admin' ? 'Super Admin' : session?.user.name

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:px-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="hidden text-sm font-medium text-muted-foreground md:block">
          {roleLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {session?.organization && (
          <div className="hidden max-w-[40%] truncate text-sm font-medium text-foreground sm:block md:max-w-none">
            {session.organization.name}
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
