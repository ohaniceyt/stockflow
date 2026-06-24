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
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
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
        'h-9 px-4 py-2 text-sm': size === 'default',
        'h-8 px-3 text-xs': size === 'sm',
        'h-10 px-6 text-base': size === 'lg',
        'h-9 w-9 p-0': size === 'icon',
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
