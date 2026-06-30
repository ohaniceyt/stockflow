import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/lib/theme'

const cycle: Theme[] = ['light', 'dark', 'system']

const icons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const labels: Record<Theme, string> = {
  light: 'Mode clair',
  dark: 'Mode sombre',
  system: 'Mode système',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const Icon = icons[theme]

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length])}
      aria-label={`Thème actuel : ${labels[theme]}. Cliquez pour changer.`}
      title={labels[theme]}
    >
      <Icon className="h-5 w-5" />
    </Button>
  )
}
