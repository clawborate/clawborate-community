'use client'
/**
 * useUITab — read-only state hook for the dynamic MD-driven UI tab.
 *
 * - Fetches initial state via GET /api/teams/{teamId}/ui/state on mount.
 * - Subscribes to DynamicUIWS for real-time ui-extensions.md change events.
 *
 * The dashboard is a pure data display: layout + visibility + data sources
 * are all declared in the agent's ui-extensions.md. This hook surfaces the
 * raw MD content + tab metadata to the renderer; it does not handle any
 * form submissions or persistence (all dropped — see PR following the form
 * cleanup).
 */
import { useEffect, useRef, useState } from 'react'
import { DynamicUIWS } from '@/lib/ws'

export interface UITabState {
  active: boolean
  content: string
  /** Title parsed from MD frontmatter (`title: ...`). "" when not set. */
  title: string
  /** Unix epoch seconds of the last ui-extensions.md write. 0 when unknown. */
  mtime: number
}

function readMeta(content: string): { title: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { title: '' }
  for (const line of match[1].split('\n')) {
    const indent = line.match(/^( *)/)?.[1].length ?? 0
    if (indent !== 0) continue       // only top-level keys
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const k = line.slice(0, colon).trim()
    const v = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
    if (k === 'title') return { title: v }
  }
  return { title: '' }
}

export function useUITab(teamId: string | undefined) {
  const [state, setState] = useState<UITabState>({
    active: false,
    content: '',
    title: '',
    mtime: 0,
  })

  const wsRef = useRef<DynamicUIWS | null>(null)

  useEffect(() => {
    if (!teamId) return

    fetch(`/api/teams/${teamId}/ui/state`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((s: { active: boolean; content: string } | null) => {
        if (s) {
          const meta = readMeta(s.content)
          setState(prev => ({ ...prev, active: s.active, content: s.content, title: meta.title }))
        }
      })
      .catch(() => {})

    const ws = new DynamicUIWS()
    wsRef.current = ws
    ws.connect(teamId, (update) => {
      const meta = readMeta(update.content)
      setState({
        active: update.active,
        content: update.content,
        title: meta.title,
        mtime: update.mtime || 0,
      })
    })

    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [teamId])

  return state
}
