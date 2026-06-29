import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  backTo?: string
  className?: string
}

export function PageHeader({ title, description, actions, backTo, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2 text-muted-foreground">
            <a href={backTo} className="inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Retour
            </a>
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description != null && <p className="text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
