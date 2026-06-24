import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/AuthContext'

interface RequirePlatformAdminProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequirePlatformAdmin({ children, fallback }: RequirePlatformAdminProps) {
  const { isAuthenticated, isPlatformAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isPlatformAdmin) {
    if (fallback) return fallback
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
