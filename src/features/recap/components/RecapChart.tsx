import { format, eachDayOfInterval, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface RecapChartProps {
  movements: MovementWithDetails[]
  startDate: Date
  endDate: Date
}

export function RecapChart({ movements, startDate, endDate }: RecapChartProps) {
  const days = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) })

  const data = days.map((day) => {
    const dayMovements = movements.filter((m) => {
      const mDate = startOfDay(new Date(m.createdAt))
      return mDate.getTime() === day.getTime()
    })

    const inQty = dayMovements
      .filter((m) => m.type === 'IN')
      .reduce((sum, m) => sum + m.quantity, 0)
    const outQty = dayMovements
      .filter((m) => m.type === 'OUT')
      .reduce((sum, m) => sum + m.quantity, 0)

    return {
      label: format(day, 'dd/MM', { locale: fr }),
      in: inQty,
      out: outQty,
    }
  })

  const hasData = movements.length > 0

  return (
    <div className="card p-4">
      <h3 className="card-t">Flux entrées / sorties</h3>
      <div className="h-72">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="in" name="Entrées" fill="var(--emerald)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="Sorties" fill="var(--rose)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="dash-empty flex h-full items-center justify-center">
            Aucune donnée pour la période sélectionnée.
          </div>
        )}
      </div>
    </div>
  )
}
