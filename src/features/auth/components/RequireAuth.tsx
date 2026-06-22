import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '@/types'

interface RequireAuthProps {
  children: React.ReactNode
  roles?: UserRole[]
  fallback?: React.ReactNode
}

export function RequireAuth({ children, roles, fallback }: RequireAuthProps) {
  const { isAuthenticated, hasRole, session } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (session?.forcePinChange && location.pathname !== '/change-pin') {
    return <Navigate to="/change-pin" replace />
  }

  if (roles && !hasRole(roles)) {
    if (fallback) return fallback
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
