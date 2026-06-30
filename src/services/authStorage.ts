const STORAGE_KEY = 'sf-auth-session'

export const authStorage = {
  getItem: (key: string): string | null => {
    if (key !== STORAGE_KEY) return null
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (key !== STORAGE_KEY) return
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // Storage may be disabled or full; ignore.
    }
  },
  removeItem: (key: string): void => {
    if (key !== STORAGE_KEY) return
    try {
      sessionStorage.removeItem(key)
    } catch {
      // Ignore.
    }
  },
}
