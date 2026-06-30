import { useDarkMode } from '@/lib/useDarkMode'

interface LogoProps {
  className?: string
  variant?: 'horizontal' | 'wordmark' | 'icon'
  alt?: string
  fetchpriority?: 'high' | 'low' | 'auto'
}

const viewBoxes: Record<string, { width: number; height: number }> = {
  '/logo': { width: 3310, height: 620 },
  '/wordmark': { width: 2312, height: 496 },
  '/app-icon': { width: 512, height: 512 },
}

export function Logo({
  className = 'h-7',
  variant = 'horizontal',
  alt = 'StockFlow',
  fetchpriority = 'auto',
}: LogoProps) {
  const isDark = useDarkMode()
  const base = variant === 'wordmark' ? '/wordmark' : variant === 'icon' ? '/app-icon' : '/logo'
  const { width, height } = viewBoxes[base]

  return (
    <img
      src={`${base}${isDark ? '-dark' : ''}.svg`}
      alt={alt}
      className={className}
      width={width}
      height={height}
      fetchPriority={fetchpriority}
    />
  )
}
