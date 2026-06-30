import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/AuthContext'
import { OfflineStatus } from '@/features/offline/components/OfflineStatus'
import { useWebVitals } from '@/hooks/useWebVitals'
import { SudoBanner } from '@/features/back-office/components/SudoBanner'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileMenuSheet } from './MobileMenuSheet'
import { MobileNav } from './MobileNav'
import { SkipLink } from '@/components/SkipLink'

export function AppLayout() {
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  useWebVitals()

  if (!session) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <SkipLink />
      <Sidebar />
      <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />

      <main id="main-content" className="flex-1 overflow-auto md:pl-[240px]">
        <Topbar onMenuOpen={() => setMenuOpen(true)} />
        <div className="space-y-6 p-4 pb-24 md:space-y-8 md:p-6 md:pb-6 lg:p-8">
          <SudoBanner />
          <Outlet />
        </div>
      </main>

      <MobileNav onMenuOpen={() => setMenuOpen(true)} />
      <OfflineStatus className="bottom-20 md:bottom-4" />
    </div>
  )
}
