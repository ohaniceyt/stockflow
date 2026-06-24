import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '@/types'

interface RequireAuthProps {
  children: React.ReactNode
  roles?: UserRole[]
  requirePlatformAdmin?: boolean
  fallback?: React.ReactNode
}

export function RequireAuth({ children, roles, requirePlatformAdmin, fallback }: RequireAuthProps) {
  const { isAuthenticated, hasRole, isPlatformAdmin, session } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (session?.needsOrganization && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  if (session?.membership.forcePinChange && location.pathname !== '/change-pin') {
    return <Navigate to="/change-pin" replace />
  }

  if (requirePlatformAdmin && !isPlatformAdmin) {
    if (fallback) return fallback
    return <Navigate to="/unauthorized" replace />
  }

  if (roles && !requirePlatformAdmin && !hasRole(roles)) {
    if (fallback) return fallback
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
