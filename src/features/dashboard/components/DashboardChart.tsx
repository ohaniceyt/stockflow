import { format, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface DashboardChartProps {
  movements: MovementWithDetails[]
}

export function DashboardChart({ movements }: DashboardChartProps) {
  const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
  const data = days.map((day) => {
    const dayMovements = movements.filter((m) => {
      const mDate = new Date(m.createdAt)
      return (
        mDate.getFullYear() === day.getFullYear() &&
        mDate.getMonth() === day.getMonth() &&
        mDate.getDate() === day.getDate()
      )
    })
    return {
      label: format(day, 'EEE', { locale: fr }),
      in: dayMovements.filter((m) => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0),
      out: dayMovements.filter((m) => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0),
    }
  })

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Mouvements sur 7 jours</h3>
      <div className="h-64">
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
