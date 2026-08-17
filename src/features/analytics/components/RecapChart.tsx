import { eachDayOfInterval, format, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyFluxPoint } from '@/features/dashboard/services/dashboardService'

interface RecapChartProps {
  daily: DailyFluxPoint[]
  startDate: Date
  endDate: Date
}

export function RecapChart({ daily, startDate, endDate }: RecapChartProps) {
  const days = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) })
  const map = new Map(daily.map((d) => [d.day, d]))

  const data = days.map((day) => {
    const key = format(day, 'yyyy-MM-dd')
    const point = map.get(key)
    return {
      label: format(day, 'dd/MM', { locale: fr }),
      in: point?.in_qty ?? 0,
      out: point?.out_qty ?? 0,
    }
  })

  const hasData = daily.length > 0

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Flux entrées / sorties
      </h3>
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
          <div className="flex h-full items-center justify-center text-base text-muted-foreground">
            Aucune donnée pour la période sélectionnée.
          </div>
        )}
      </div>
    </div>
  )
}
