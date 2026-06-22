import { format, subDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface RecapChartProps {
  movements: MovementWithDetails[]
  days?: number
}

export function RecapChart({ movements, days = 14 }: RecapChartProps) {
  const today = startOfDay(new Date())
  const chartDays = Array.from({ length: days }, (_, i) => subDays(today, days - 1 - i))

  const data = chartDays.map((day) => {
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

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Mouvements sur {days} jours
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="in" name="Entrées" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="out" name="Sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
