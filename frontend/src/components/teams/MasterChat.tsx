'use client'
/**
 * MasterChat — right-panel chat with the master agent.
 * Thin wrapper around ChatPanel + unread tracking.
 * ChatPanel owns the single WS connection; exposes unread state via callbacks.
 */
import { useState, useRef, useCallback } from 'react'
import { Bot } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import ChatPanel from '@/components/chat/ChatPanel'
import { getT } from '@/lib/locales'
import { api } from '@/lib/api'
import type { Lang } from '@/lib/locales'
import type { AgentStatus } from '@/types'
import type { ChatMessage } from '@/types/chat'

interface Props {
  teamId: string
  masterId: string
  masterName: string
  masterStatus: AgentStatus
  lang: Lang
}

export default function MasterChat({ teamId, masterId, masterName, masterStatus, lang }: Props) {
  const t = getT(lang)
  const tc = t.chat

  const [confirmClear, setConfirmClear] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const clearRef          = useRef<() => void>(() => {})
  const scrollToUnreadRef = useRef<() => void>(() => {})

  const handleUnreadChange = useCallback((count: number, _markRead: () => void) => {
    setUnreadCount(count)
  }, [])

  const handleClearReady = useCallback((clearFn: () => void) => {
    clearRef.current = clearFn
  }, [])

  // Notifications are pushed via WebSocket by the backend (no polling needed)

  const handleClearHistory = async () => {
    try { await api.clearMasterChatHistory(teamId) } catch { /* ignore */ }
    clearRef.current()
    setConfirmClear(false)
  }

  const header = (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(88,166,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Bot size={16} color="var(--accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{masterName || tc.title}</div>
        <StatusBadge status={masterStatus} small />
      </div>
      {unreadCount > 0 && (
        <button onClick={() => scrollToUnreadRef.current()} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#F85149', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>
          {unreadCount} {tc.unreadPill}
        </button>
      )}
      {confirmClear ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{tc.clearConfirm}</span>
          <button onClick={handleClearHistory} style={{ fontSize: 11, color: '#F85149', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>{tc.clearBtn}</button>
          <button onClick={() => setConfirmClear(false)} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>{tc.cancelBtn}</button>
        </div>
      ) : (
        <button onClick={() => setConfirmClear(true)}
          style={{ fontSize: 11, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F85149')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8B949E')}>
          {tc.clear}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--border-default)' }}>
      <ChatPanel
        teamId={teamId}
        agentId={masterId}
        withImages
        extraHeader={header}
        trackUnread
        onUnreadChange={handleUnreadChange}
        onClearReady={handleClearReady}
        onScrollToUnreadReady={(fn) => { scrollToUnreadRef.current = fn }}
      />
    </div>
  )
}
