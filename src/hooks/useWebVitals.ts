import { useEffect } from 'react'

interface WebVitalMetric {
  name: string
  value: number
  id: string
}

function sendWebVital(metric: WebVitalMetric): void {
  if (import.meta.env.DEV) {
    console.log('[WebVital]', metric.name, metric.value)
    return
  }
  // Placeholder: send to analytics endpoint / RUM provider.
  // Example: fetch('/api/rum', { method: 'POST', body: JSON.stringify(metric) })
}

export function useWebVitals(): void {
  useEffect(() => {
    if (!('performance' in window) || !('getEntriesByType' in performance)) return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'web-vitals') {
          const vital = entry as unknown as { id?: string }
          sendWebVital({
            name: entry.name,
            value: entry.startTime,
            id: vital.id ?? entry.name,
          })
        }
      }
    })

    try {
      observer.observe({ type: 'web-vitals', buffered: true })
    } catch {
      // Browser does not support web-vitals observer type.
    }

    return () => observer.disconnect()
  }, [])
}
