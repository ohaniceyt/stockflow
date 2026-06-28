import { useEffect, useState } from 'react'

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const update = () => {
      setIsDark(document.documentElement.classList.contains('dark') || mediaQuery.matches)
    }

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    mediaQuery.addEventListener('change', update)
    update()

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', update)
    }
  }, [])

  return isDark
}
