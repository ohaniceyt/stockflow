interface LogoProps {
  className?: string
  variant?: 'horizontal' | 'wordmark' | 'icon'
  alt?: string
}

export function Logo({ className = 'h-7', variant = 'horizontal', alt = 'Flowbill' }: LogoProps) {
  const src =
    variant === 'wordmark' ? '/wordmark.svg' : variant === 'icon' ? '/app-icon.svg' : '/logo.svg'

  return <img src={src} alt={alt} className={className} />
}
