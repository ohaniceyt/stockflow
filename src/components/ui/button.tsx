import { cn } from '@/lib/utils'
import {
  Children,
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  type ReactElement,
} from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'default', asChild = false, children, ...props },
    ref
  ) => {
    const classes = cn(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors touch-manipulation',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      {
        'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
        'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
        'border bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        'bg-destructive text-destructive-foreground hover:bg-destructive/90':
          variant === 'destructive',
      },
      {
        'h-11 min-h-[44px] px-4 py-2 text-sm sm:h-9': size === 'default',
        'h-10 min-h-[40px] px-3 text-xs sm:h-8': size === 'sm',
        'h-12 min-h-[48px] px-6 text-base': size === 'lg',
        'h-11 min-h-[44px] w-11 min-w-[44px] p-0 sm:h-9 sm:w-9': size === 'icon',
      },
      className
    )

    if (asChild) {
      const child = Children.only(children) as ReactElement<{ className?: string }>
      return cloneElement(child, {
        className: cn(classes, child.props.className),
        ...props,
      } as Record<string, unknown>)
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
