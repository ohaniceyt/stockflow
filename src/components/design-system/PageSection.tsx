import { cn } from '@/lib/utils'

export interface PageSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function PageSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title != null || description != null) && (
        <div className="space-y-1">
          {title != null && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
          {description != null && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn('rounded-xl border bg-card p-5 shadow-sm md:p-6', contentClassName)}>
        {children}
      </div>
    </section>
  )
}
