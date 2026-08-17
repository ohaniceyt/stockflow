import { ArrowRightLeft } from 'lucide-react'
import { EmptyState } from '@/components/design-system'
import type { RotationRow } from '@/features/dashboard/services/dashboardService'

interface DashboardRotationProps {
  rotation: RotationRow[]
}

export function DashboardRotation({ rotation }: DashboardRotationProps) {
  if (rotation.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Taux de rotation
        </h3>
        <EmptyState
          icon={ArrowRightLeft}
          title="Données insuffisantes"
          description="Enregistrez des sorties et du stock pour voir les taux de rotation."
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Taux de rotation
      </h3>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Produit</th>
              <th className="pb-2 font-medium text-right">Sorties</th>
              <th className="pb-2 font-medium text-right">Stock</th>
              <th className="pb-2 font-medium text-right">Rotation</th>
            </tr>
          </thead>
          <tbody>
            {rotation.map((row) => (
              <tr key={row.product_id} className="border-b last:border-0">
                <td className="max-w-[40%] truncate py-2 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="py-2 text-right text-foreground">
                  {row.sold_qty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right text-foreground">
                  {row.current_qty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right font-semibold text-indigo-600">
                  {row.ratio.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rotation.map((row) => (
          <div key={row.product_id} className="rounded-lg border bg-background p-3">
            <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">
                  {row.sold_qty.toLocaleString('fr-FR')}
                </p>
                <p>Sorties</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {row.current_qty.toLocaleString('fr-FR')}
                </p>
                <p>Stock</p>
              </div>
              <div>
                <p className="font-semibold text-indigo-600">{row.ratio.toFixed(2)}</p>
                <p>Rotation</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
