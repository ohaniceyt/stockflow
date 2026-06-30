import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from '@/lib/theme-context'
import { resolveTheme, STORAGE_KEY, type Theme } from '@/lib/theme'

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: ReactNode
  defaultTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? defaultTheme
    } catch {
      return defaultTheme
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      document.documentElement.classList.toggle('dark', mediaQuery.matches)
    }
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (next: Theme) => setThemeState(next)

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
