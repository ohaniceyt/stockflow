import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LandingApp from './features/marketing/LandingApp'
import '@fontsource-variable/geist'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <LandingApp />
  </StrictMode>
)
