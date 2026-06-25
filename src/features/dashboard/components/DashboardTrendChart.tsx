import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

type Period = 30 | 90 | 'custom'

interface DashboardTrendChartProps {
  movements: MovementWithDetails[]
}

function getDayKey(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
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

  const maxValue = Math.max(...aggregated.map((d) => d.value), 1)
  const padding = { top: 24, right: 16, bottom: 48, left: 40 }
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
    ctx.fillStyle = 'var(--text-faint)'
    ctx.font = '11px Geist Variable, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(value), padding.left - 8, y + 3)
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

  ctx.fillStyle = 'var(--text)'
  ctx.font = '11px Geist Variable, sans-serif'
  ctx.textAlign = 'center'
  aggregated.forEach((d, i) => {
    const show = aggregated.length <= 14 || i % 7 === 0 || i === aggregated.length - 1 || i === 0
    if (!show) return
    ctx.fillText(d.label, padding.left + stepX * i, cssHeight - 24)
  })
}

export function DashboardTrendChart({ movements }: DashboardTrendChartProps) {
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [period, setPeriod] = useState<Period>(30)
  const [startDate, setStartDate] = useState<string>(toInputDate(thirtyDaysAgo))
  const [endDate, setEndDate] = useState<string>(toInputDate(today))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const isCustom = period === 'custom'

  const filteredMovements = movements.filter((m) => {
    const mDate = new Date(m.createdAt)
    if (period === 'custom') {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      return m.type === 'OUT' && mDate >= start && mDate <= end
    }
    const limit = new Date()
    limit.setDate(limit.getDate() - period)
    return m.type === 'OUT' && mDate >= limit
  })

  const aggregated = (() => {
    const map = new Map<string, number>()
    let days: number
    let start: Date
    let end: Date

    if (period === 'custom') {
      start = new Date(startDate)
      end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    } else {
      days = period
      end = new Date()
      start = new Date()
      start.setDate(end.getDate() - (days - 1))
    }

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      map.set(getDayKey(d), 0)
    }

    filteredMovements.forEach((m) => {
      const key = getDayKey(new Date(m.createdAt))
      map.set(key, (map.get(key) ?? 0) + m.quantity)
    })

    return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
  })()

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
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="card-t flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-[var(--indigo)]" />
          Tendance des sorties
        </h3>
        <div className="flex gap-1.5">
          {[30, 90].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p as Period)}
              className={`${period === p ? 'btn-p' : 'btn-o'} btn-sm`}
            >
              {p}j
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`${isCustom ? 'btn-p' : 'btn-o'} btn-sm`}
          >
            Perso
          </button>
        </div>
      </div>

      {isCustom && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-[var(--text)]">
            Du
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-h)]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-[var(--text)]">
            au
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={toInputDate(today)}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-h)]"
            />
          </label>
        </div>
      )}

      <div ref={wrapperRef} className="ch-trend h-48 w-full">
        {aggregated.some((d) => d.value > 0) ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="dash-empty flex h-full items-center justify-center">
            Aucune sortie sur la période.
          </div>
        )}
      </div>
    </div>
  )
}
