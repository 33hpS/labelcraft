import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: ThemeMode
  resolved: 'light' | 'dark'
  setTheme: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

function getSystemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyHtmlClass(mode: ThemeMode) {
  const root = document.documentElement
  const prefersDark = getSystemPrefersDark()
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      return saved ?? 'system'
    } catch {
      return 'system'
    }
  })

  const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
    const prefersDark = typeof window !== 'undefined' && getSystemPrefersDark()
    return (theme === 'dark' || (theme === 'system' && prefersDark)) ? 'dark' : 'light'
  })

  useEffect(() => {
    // Apply class and persist
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
    applyHtmlClass(theme)
    const prefersDark = getSystemPrefersDark()
    setResolved((theme === 'dark' || (theme === 'system' && prefersDark)) ? 'dark' : 'light')
  }, [theme])

  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        applyHtmlClass('system')
        setResolved(mql.matches ? 'dark' : 'light')
      }
    }
    try {
      mql.addEventListener('change', handler)
    } catch {
      // Safari
      // @ts-ignore
      mql.addListener(handler)
    }
    return () => {
      try {
        mql.removeEventListener('change', handler)
      } catch {
        // @ts-ignore
        mql.removeListener(handler)
      }
    }
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), [])
  const toggle = useCallback(() => {
    setThemeState(prev => {
      const next = (prev === 'dark' || (prev === 'system' && getSystemPrefersDark())) ? 'light' : 'dark'
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
