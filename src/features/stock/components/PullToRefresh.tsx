import { useRef, useState, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void>
  disabled?: boolean
}

export function PullToRefresh({ children, onRefresh, disabled }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pulling, setPulling] = useState(false)
  const [offset, setOffset] = useState(0)
  const startY = useRef(0)
  const isRefreshing = useRef(false)

  const threshold = 80

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing.current) return
    const el = containerRef.current
    if (!el) return
    if (el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY
      setPulling(true)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling || isRefreshing.current) return
    const y = e.touches[0].clientY
    const delta = Math.max(0, y - startY.current)
    const damped = Math.min(delta * 0.5, threshold + 40)
    setOffset(damped)
  }

  const onTouchEnd = async () => {
    if (!pulling) return
    if (offset >= threshold && !isRefreshing.current) {
      isRefreshing.current = true
      setOffset(threshold)
      try {
        await onRefresh()
      } finally {
        setPulling(false)
        setOffset(0)
        isRefreshing.current = false
      }
    } else {
      setPulling(false)
      setOffset(0)
    }
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative h-full overflow-y-auto"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center transition-transform"
        style={{
          transform: `translateY(${String(offset - threshold)}px)`,
          opacity: offset > 20 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-[var(--shadow-xs)]">
          <RotateCw className={`h-4 w-4 ${offset >= threshold ? 'animate-spin' : ''}`} />
          {offset >= threshold ? 'Relâcher pour rafraîchir' : 'Tirer pour rafraîchir'}
        </div>
      </div>
      <div
        className="transition-transform"
        style={{ transform: pulling ? `translateY(${String(offset)}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
