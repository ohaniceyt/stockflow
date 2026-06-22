import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-8">Chargement...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
