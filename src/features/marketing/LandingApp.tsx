import { useEffect, useState, type ComponentType } from 'react'

import LandingPage from './pages/LandingPage'
import InventoryFeaturePage from './pages/InventoryFeaturePage'
import PosCashierFeaturePage from './pages/PosCashierFeaturePage'
import InvoicingFeaturePage from './pages/InvoicingFeaturePage'
import OfflineFeaturePage from './pages/OfflineFeaturePage'
import AnalyticsFeaturePage from './pages/AnalyticsFeaturePage'
import PricingPage from './pages/PricingPage'

const routes: Record<string, ComponentType> = {
  '/': LandingPage,
  '/features/inventory': InventoryFeaturePage,
  '/features/pos-cashier': PosCashierFeaturePage,
  '/features/invoicing': InvoicingFeaturePage,
  '/features/offline': OfflineFeaturePage,
  '/features/analytics': AnalyticsFeaturePage,
  '/pricing': PricingPage,
}

interface LandingAppProps {
  initialPath?: string
}

export default function LandingApp({ initialPath }: LandingAppProps) {
  const [path, setPath] = useState(() =>
    initialPath ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    window.addEventListener('navigate-landing', updatePath)
    return () => {
      window.removeEventListener('popstate', updatePath)
      window.removeEventListener('navigate-landing', updatePath)
    }
  }, [])

  const Component = routes[path] ?? LandingPage
  return <Component />
}
