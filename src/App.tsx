import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from '@/features/auth/context/AuthContext'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
const AppLayout = lazy(() =>
  import('@/components/layout/AppLayout').then((mod) => ({ default: mod.AppLayout }))
)
import { AppLock } from '@/features/auth/components/AppLock'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const BackOfficeLoginPage = lazy(() => import('@/features/auth/pages/BackOfficeLoginPage'))
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'))
const AuthVerificationPage = lazy(() => import('@/features/auth/pages/AuthVerificationPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const ResetPinPage = lazy(() => import('@/features/auth/pages/ResetPinPage'))
const ChangePinPage = lazy(() => import('@/features/auth/pages/ChangePinPage'))
const SetPinPage = lazy(() => import('@/features/auth/pages/SetPinPage'))
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const StockPage = lazy(() => import('@/features/stock/pages/StockPage'))
const MovementsPage = lazy(() => import('@/features/movements/pages/MovementsPage'))
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'))
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'))
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage'))
const LocationsPage = lazy(() => import('@/features/locations/pages/LocationsPage'))
const SuppliersPage = lazy(() => import('@/features/contacts/pages/SuppliersPage'))
const CustomersPage = lazy(() => import('@/features/contacts/pages/CustomersPage'))
const AnalyticsPage = lazy(() => import('@/features/analytics/pages/AnalyticsPage'))
const CashierPage = lazy(() => import('@/features/cashier/pages/CashierPage'))
const CashierPosPage = lazy(() => import('@/features/cashier/pages/CashierPosPage'))
const SubscriptionPage = lazy(() => import('@/features/settings/pages/SubscriptionPage'))
const ProfilePage = lazy(() => import('@/features/settings/pages/ProfilePage'))
const OrganizationSettingsPage = lazy(() => import('@/features/settings/pages/OrganizationPage'))
const ApiKeysPage = lazy(() => import('@/features/api/pages/ApiKeysPage'))
const InvitePage = lazy(() => import('@/features/team/pages/InvitePage'))
const UnauthorizedPage = lazy(() => import('@/features/auth/pages/UnauthorizedPage'))

const BackOfficeLayout = lazy(() => import('@/features/back-office/components/BackOfficeLayout'))
const BackOfficeOverviewPage = lazy(
  () => import('@/features/back-office/pages/BackOfficeOverviewPage')
)
const BackOfficeOrganizationsPage = lazy(
  () => import('@/features/back-office/pages/BackOfficeOrganizationsPage')
)
const BackOfficeOrganizationDetailPage = lazy(
  () => import('@/features/back-office/pages/BackOfficeOrganizationDetailPage')
)
const BackOfficeUsersPage = lazy(() => import('@/features/back-office/pages/BackOfficeUsersPage'))
const BackOfficeUserDetailPage = lazy(
  () => import('@/features/back-office/pages/BackOfficeUserDetailPage')
)
const BackOfficeAuditLogsPage = lazy(
  () => import('@/features/back-office/pages/BackOfficeAuditLogsPage')
)
const StorefrontPage = lazy(() => import('@/features/storefront/pages/StorefrontPage'))
const RequirePlatformAdmin = lazy(() =>
  import('@/features/back-office/components/RequirePlatformAdmin').then((mod) => ({
    default: mod.RequirePlatformAdmin,
  }))
)

const fallback = <div className="p-8">Chargement...</div>

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/back-office" element={<BackOfficeLoginPage />} />
          <Route path="/auth/verification" element={<AuthVerificationPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/reset-pin" element={<ResetPinPage />} />
          <Route path="/invite" element={<InvitePage />} />

          <Route
            path="/change-pin"
            element={
              <RequireAuth>
                <ChangePinPage />
              </RequireAuth>
            }
          />
          <Route
            path="/set-pin"
            element={
              <RequireAuth>
                <SetPinPage />
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
            <Route path="/dashboard" element={<DashboardPage />} />
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
              path="/settings/team"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <TeamPage />
                </RequireAuth>
              }
            />
            <Route path="/team" element={<Navigate to="/settings/team" replace />} />
            <Route
              path="/locations"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <LocationsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/suppliers"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <SuppliersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/customers"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <CustomersPage />
                </RequireAuth>
              }
            />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/recap" element={<Navigate to="/analytics" replace />} />
            <Route
              path="/cashier"
              element={
                <RequireAuth roles={['super_admin', 'admin', 'operator', 'cashier']}>
                  <CashierPage />
                </RequireAuth>
              }
            />
            <Route path="/settings/profile" element={<ProfilePage />} />
            <Route
              path="/settings/organization"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <OrganizationSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings/api"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <ApiKeysPage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings/storefront"
              element={
                <RequireAuth roles={['super_admin', 'admin']}>
                  <OrganizationSettingsPage />
                </RequireAuth>
              }
            />
            <Route path="/settings/subscription" element={<SubscriptionPage />} />
            <Route path="/settings/*" element={<Navigate to="/settings/profile" replace />} />
          </Route>

          <Route
            path="/caisse-pos"
            element={
              <RequireAuth roles={['super_admin', 'admin', 'operator', 'cashier']}>
                <CashierPosPage />
              </RequireAuth>
            }
          />

          <Route
            element={
              <RequirePlatformAdmin>
                <BackOfficeLayout />
              </RequirePlatformAdmin>
            }
          >
            <Route path="/back-office" element={<BackOfficeOverviewPage />} />
            <Route path="/back-office/organizations" element={<BackOfficeOrganizationsPage />} />
            <Route
              path="/back-office/organizations/:orgId"
              element={<BackOfficeOrganizationDetailPage />}
            />
            <Route path="/back-office/users" element={<BackOfficeUsersPage />} />
            <Route path="/back-office/users/:userId" element={<BackOfficeUserDetailPage />} />
            <Route path="/back-office/audit-logs" element={<BackOfficeAuditLogsPage />} />
          </Route>

          <Route path="/store/:orgSlug" element={<StorefrontPage />} />

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      <AppLock />
    </AuthProvider>
  )
}

export default App
