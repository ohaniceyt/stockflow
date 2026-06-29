import { useEffect, useMemo, useRef } from 'react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface DashboardFluxChartProps {
  movements: MovementWithDetails[]
}

function getDayKey(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

interface DailyTotal {
  label: string
  in: number
  out: number
}

function getDailyTotals(movements: MovementWithDetails[]): DailyTotal[] {
  const days: DailyTotal[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)

    const dayMovements = movements.filter((m) => {
      const mDate = new Date(m.createdAt)
      return mDate >= d && mDate < next
    })

    days.push({
      label: getDayKey(d),
      in: dayMovements.filter((m) => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0),
      out: dayMovements
        .filter((m) => m.type === 'OUT' && !m.isCancelled)
        .reduce((sum, m) => sum + m.quantity, 0),
    })
  }
  return days
}

function drawChart(canvas: HTMLCanvasElement, wrapper: HTMLDivElement, days: DailyTotal[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = wrapper.getBoundingClientRect()
  const cssWidth = Math.max(rect.width, 300)
  const cssHeight = 256

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = `${String(cssWidth)}px`
  canvas.style.height = `${String(cssHeight)}px`

  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const maxValue = Math.max(...days.flatMap((d) => [d.in, d.out]), 1)

  const fontSize = cssWidth < 400 ? 12 : 13
  const fontSpec = `${String(fontSize)}px Geist Variable, sans-serif`
  const padding = { top: 24, right: 16, bottom: 56, left: 44 }
  const chartW = cssWidth - padding.left - padding.right
  const chartH = cssHeight - padding.top - padding.bottom

  ctx.strokeStyle = 'var(--border)'
  ctx.lineWidth = 1
  const gridCount = 5
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

  const barGroupWidth = chartW / days.length
  const barWidth = barGroupWidth * 0.32
  const barGap = barGroupWidth * 0.08

  days.forEach((day, index) => {
    const groupX = padding.left + barGroupWidth * index + barGroupWidth / 2

    const inH = (day.in / maxValue) * chartH
    const outH = (day.out / maxValue) * chartH

    // Entrées — dégradé emerald + ombre
    const inGradient = ctx.createLinearGradient(
      0,
      padding.top + chartH - inH,
      0,
      padding.top + chartH
    )
    inGradient.addColorStop(0, '#34d399')
    inGradient.addColorStop(1, '#059669')
    ctx.fillStyle = inGradient
    ctx.shadowColor = 'rgba(5, 150, 105, 0.25)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
    ctx.fillRect(groupX - barWidth - barGap / 2, padding.top + chartH - inH, barWidth, inH)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Sorties — dégradé rose + ombre
    const outGradient = ctx.createLinearGradient(
      0,
      padding.top + chartH - outH,
      0,
      padding.top + chartH
    )
    outGradient.addColorStop(0, '#fb7185')
    outGradient.addColorStop(1, '#e11d48')
    ctx.fillStyle = outGradient
    ctx.shadowColor = 'rgba(225, 29, 72, 0.25)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
    ctx.fillRect(groupX + barGap / 2, padding.top + chartH - outH, barWidth, outH)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    ctx.fillStyle = 'var(--foreground)'
    ctx.font = fontSpec
    ctx.textAlign = 'center'
    ctx.fillText(day.label, groupX, cssHeight - 24)
  })

  // Légende colorée
  const legendY = cssHeight - 12
  ctx.fillStyle = '#059669'
  ctx.shadowColor = 'rgba(5, 150, 105, 0.3)'
  ctx.shadowBlur = 4
  ctx.fillRect(cssWidth / 2 - 70, legendY - 8, 10, 10)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.fillStyle = 'var(--foreground)'
  ctx.textAlign = 'left'
  ctx.fillText('Entrées', cssWidth / 2 - 54, legendY)

  ctx.fillStyle = '#e11d48'
  ctx.shadowColor = 'rgba(225, 29, 72, 0.3)'
  ctx.shadowBlur = 4
  ctx.fillRect(cssWidth / 2 + 10, legendY - 8, 10, 10)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.fillStyle = 'var(--foreground)'
  ctx.textAlign = 'left'
  ctx.fillText('Sorties', cssWidth / 2 + 26, legendY)
}

export function DashboardFluxChart({ movements }: DashboardFluxChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const days = useMemo(() => getDailyTotals(movements), [movements])
  const hasData = useMemo(() => days.some((d) => d.in > 0 || d.out > 0), [days])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    drawChart(canvas, wrapper, days)

    const observer = new ResizeObserver(() => drawChart(canvas, wrapper, days))
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [days])

  return (
    <div ref={wrapperRef} className="ch-dash h-64 w-full">
      {hasData ? (
        <canvas ref={canvasRef} />
      ) : (
        <div className="flex h-full items-center justify-center text-base text-muted-foreground">
          Aucun mouvement sur les 7 derniers jours.
        </div>
      )}
    </div>
  )
}
