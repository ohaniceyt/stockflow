import { useContext } from 'react'
import { ThemeContext } from '@/lib/theme-context'
import type { ThemeContextValue } from '@/lib/theme-context'

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
