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

export default function LandingApp() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
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
