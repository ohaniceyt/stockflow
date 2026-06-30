export type Theme = 'light' | 'dark' | 'system'

export const STORAGE_KEY = 'stockflow-theme'

export function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemDark() ? 'dark' : 'light'
  return theme
}
