'use client'
import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    const saved = localStorage.getItem('clawborate-theme') as 'dark' | 'light' | null
    const t = saved || 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('clawborate-theme', next)

    // Sync theme to Open WebUI iframes
    document.querySelectorAll('iframe').forEach(frame => {
      const owWindow = frame.contentWindow
      if (!owWindow) return

      // P2-1: Real-time theme sync via localStorage (same-domain production)
      try {
        // Set theme in iframe's localStorage (Open WebUI reads this on load)
        owWindow.localStorage.setItem('theme', next)
        // Trigger storage event for real-time update without reload
        owWindow.dispatchEvent(new (owWindow as any).StorageEvent('storage', {
          key: 'theme',
          newValue: next
        }))
        console.log(`[Theme] Set iframe localStorage.theme = ${next}`)
      } catch (e: unknown) {
        // Cross-origin blocked (dev environment) — fallback to URL parameter
        const err = e as Error
        if (err.name === 'SecurityError' || err.message.includes("Blocked a frame")) {
          try {
            const url = new URL(frame.src)
            url.searchParams.set('__theme', next)
            frame.src = url.toString()
            console.log(`[Theme] Fallback: Reloaded iframe with __theme=${next}`)
          } catch {}  // eslint-disable-line no-empty
        }
      }
    })

    console.log(`[Theme] Toggled to: ${next}`)
  }
  return { theme, toggle }
}
