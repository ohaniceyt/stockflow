import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from '@/features/auth/context/AuthContext'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const ChangePinPage = lazy(() => import('@/features/auth/pages/ChangePinPage'))
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const StockPage = lazy(() => import('@/features/stock/pages/StockPage'))
const MovementsPage = lazy(() => import('@/features/movements/pages/MovementsPage'))
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'))
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'))
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage'))
const LocationsPage = lazy(() => import('@/features/locations/pages/LocationsPage'))
const RecapPage = lazy(() => import('@/features/recap/pages/RecapPage'))
const SuperAdminPage = lazy(() => import('@/features/super-admin/pages/SuperAdminPage'))
const UnauthorizedPage = lazy(() => import('@/features/auth/pages/UnauthorizedPage'))

const fallback = <div className="p-8">Chargement...</div>

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/change-pin"
            element={
              <RequireAuth>
                <ChangePinPage />
              </RequireAuth>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RequireAuth roles={['super_admin', 'admin']}>
                <OnboardingPage />
              </RequireAuth>
            }
          />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route
              path="/inventory"
              element={
                <RequireAuth roles={['super_admin', 'admin', 'operator']}>
                  <InventoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/products"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <ProductsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/team"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <TeamPage />
                </RequireAuth>
              }
            />
            <Route
              path="/locations"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <LocationsPage />
                </RequireAuth>
              }
            />
            <Route path="/recap" element={<RecapPage />} />
            <Route
              path="/super-admin"
              element={
                <RequireAuth roles={['super_admin']}>
                  <SuperAdminPage />
                </RequireAuth>
              }
            />
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
