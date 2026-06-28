import { useDarkMode } from '@/lib/useDarkMode'

interface LogoProps {
  className?: string
  variant?: 'horizontal' | 'wordmark' | 'icon'
  alt?: string
}

export function Logo({ className = 'h-7', variant = 'horizontal', alt = 'StockFlow' }: LogoProps) {
  const isDark = useDarkMode()
  const base = variant === 'wordmark' ? '/wordmark' : variant === 'icon' ? '/app-icon' : '/logo'

  return <img src={`${base}${isDark ? '-dark' : ''}.svg`} alt={alt} className={className} />
}
