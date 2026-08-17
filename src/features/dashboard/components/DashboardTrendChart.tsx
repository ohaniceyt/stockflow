import { useEffect, useMemo, useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import { eachDayOfInterval, format, isValid, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import type { DailyFluxPoint } from '@/features/dashboard/services/dashboardService'

type Period = 30 | 90 | 'custom'

interface DashboardTrendChartProps {
  /** Server-aggregated daily flux (covers at least [rangeFrom, rangeTo]). */
  daily: DailyFluxPoint[]
  /** Inclusive trend window start ('YYYY-MM-DD', local). */
  rangeFrom: string
  /** Inclusive trend window end ('YYYY-MM-DD', local). */
  rangeTo: string
  period: Period
  startDate: string
  endDate: string
  onPeriodChange: (p: Period) => void
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

function toInputDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function drawTrend(
  canvas: HTMLCanvasElement,
  wrapper: HTMLDivElement,
  aggregated: { label: string; value: number }[]
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = wrapper.getBoundingClientRect()
  const cssWidth = Math.max(rect.width, 300)
  const cssHeight = 200

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = `${String(cssWidth)}px`
  canvas.style.height = `${String(cssHeight)}px`

  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const fontSize = cssWidth < 400 ? 12 : 13
  const fontSpec = `${String(fontSize)}px Geist Variable, sans-serif`
  const maxValue = Math.max(...aggregated.map((d) => d.value), 1)
  const padding = { top: 24, right: 16, bottom: 48, left: 44 }
  const chartW = cssWidth - padding.left - padding.right
  const chartH = cssHeight - padding.top - padding.bottom

  ctx.strokeStyle = 'var(--border)'
  ctx.lineWidth = 1
  const gridCount = 4
  for (let i = 0; i <= gridCount; i++) {
    const y = padding.top + (chartH / gridCount) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartW, y)
    ctx.stroke()

    const value = Math.round(maxValue - (maxValue / gridCount) * i)
    ctx.fillStyle = 'var(--muted-foreground)'
    ctx.font = fontSpec
    ctx.textAlign = 'right'
    ctx.fillText(String(value), padding.left - 8, y + 4)
  }

  const stepX = chartW / (aggregated.length - 1 || 1)
  const points = aggregated.map((d, i) => ({
    x: padding.left + stepX * i,
    y: padding.top + chartH - (d.value / maxValue) * chartH,
  }))

  if (points.length > 1) {
    ctx.beginPath()
    ctx.moveTo(points[0].x, padding.top + chartH)
    points.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH)
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.35)')
    gradient.addColorStop(0.5, 'rgba(79, 70, 229, 0.1)')
    gradient.addColorStop(1, 'rgba(79, 70, 229, 0)')
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(79, 70, 229, 0.35)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    points.forEach((p, i) => {
      const show = aggregated.length <= 14 || i % 7 === 0 || i === points.length - 1 || i === 0
      if (!show) return

      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 || i === points.length - 1 ? '#4f46e5' : '#6366f1'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.25)'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  ctx.fillStyle = 'var(--foreground)'
  ctx.font = fontSpec
  ctx.textAlign = 'center'
  aggregated.forEach((d, i) => {
    const show = aggregated.length <= 14 || i % 7 === 0 || i === aggregated.length - 1 || i === 0
    if (!show) return
    ctx.fillText(d.label, padding.left + stepX * i, cssHeight - 24)
  })
}

export function DashboardTrendChart({
  daily,
  rangeFrom,
  rangeTo,
  period,
  startDate,
  endDate,
  onPeriodChange,
  onStartChange,
  onEndChange,
}: DashboardTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const isCustom = period === 'custom'

  const aggregated = useMemo(() => {
    const from = parseISO(rangeFrom)
    const to = parseISO(rangeTo)
    if (!isValid(from) || !isValid(to) || from > to) return [] as { label: string; value: number }[]
    const map = new Map(daily.map((d) => [d.day, d]))
    return eachDayOfInterval({ start: from, end: to }).map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const point = map.get(key)
      return { label: format(day, 'dd/MM'), value: point?.out_qty ?? 0 }
    })
  }, [daily, rangeFrom, rangeTo])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    drawTrend(canvas, wrapper, aggregated)

    const observer = new ResizeObserver(() => drawTrend(canvas, wrapper, aggregated))
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [aggregated])

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
          Tendance des sorties
        </h3>
        <div className="flex gap-1.5">
          {[30, 90].map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => onPeriodChange(p as Period)}
            >
              {p}j
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={isCustom ? 'default' : 'outline'}
            onClick={() => onPeriodChange('custom')}
          >
            Perso
          </Button>
        </div>
      </div>

      {isCustom && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-foreground">
            Du
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => onStartChange(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-foreground">
            au
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={toInputDate(new Date())}
              onChange={(e) => onEndChange(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
        </div>
      )}

      <div ref={wrapperRef} className="ch-trend h-48 w-full">
        {aggregated.some((d) => d.value > 0) ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="flex h-full items-center justify-center text-base text-muted-foreground">
            Aucune sortie sur la période.
          </div>
        )}
      </div>
    </div>
  )
}
