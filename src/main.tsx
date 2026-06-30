import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './components/ThemeProvider'
import '@fontsource-variable/geist'
import './index.css'
import { initSentry } from './lib/sentry'

void initSentry().catch(() => {
  // Sentry is optional; do not block app startup.
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Keep already-rendered data visible while a background refetch runs.
      // Prevents sync invalidations from wiping the UI and resetting forms.
      placeholderData: (previousData: unknown) => previousData,
    },
  },
})

// Register the service worker for PWA offline support.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error: unknown) => {
        console.error('SW registration failed:', error)
      })
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
