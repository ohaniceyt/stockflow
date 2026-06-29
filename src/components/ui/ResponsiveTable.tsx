import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { cn } from '@/lib/utils'

export interface ResponsiveColumn<T> {
  key: string
  header: React.ReactNode
  cell: (item: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: ResponsiveColumn<T>[]
  keyExtractor: (item: T) => string
  empty: React.ReactNode
  className?: string
  mobileCardTitle?: (item: T) => React.ReactNode
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  empty,
  className,
  mobileCardTitle,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <>{empty}</>
  }

  const visibleMobileColumns = columns.filter((col) => !col.hideOnMobile)

  return (
    <div className={cn('space-y-4 md:space-y-0', className)}>
      {/* Desktop */}
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={keyExtractor(item)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <div key={keyExtractor(item)} className="rounded-xl border bg-card p-4 shadow-sm">
            {mobileCardTitle && (
              <div className="mb-2 border-b pb-2 font-semibold">{mobileCardTitle(item)}</div>
            )}

            <dl className="space-y-1">
              {visibleMobileColumns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 py-1">
                  <dt className="text-sm text-muted-foreground">{col.header}</dt>
                  <dd className={cn('text-sm', col.className)}>{col.cell(item)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
