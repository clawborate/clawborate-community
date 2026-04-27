'use client'
/**
 * NotificationBar (B2-3, issue #288, #329)
 *
 * Displays sub-agent notifications outside the Open WebUI iframe.
 * Positioned between the main panel and the right chat panel.
 *
 * - Subscribes to /api/ws/teams/{teamId}/notifications (WebSocket push, ~2 s latency)
 * - Shows unread count badge and the latest notification inline
 * - Expandable to show the last 5 notifications
 * - Only rendered when a team is selected
 */
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, ChevronUp } from 'lucide-react'
import { NotificationWS } from '@/lib/ws'

interface Notification {
  id: string
  from: string
  to: string
  subject: string
  message: string
  type?: string
  timestamp: string
  read_by: string[]
}

interface Props {
  teamId: string | null
}

export default function NotificationBar({ teamId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [expanded, setExpanded] = useState(false)
  const wsRef = useRef<NotificationWS | null>(null)

  useEffect(() => {
    if (!teamId) {
      setNotifications([])
      return
    }

    const ws = new NotificationWS()
    wsRef.current = ws
    ws.connect(teamId, (items) => {
      setNotifications(items)
    })

    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [teamId])

  if (!teamId) return null

  // 'master' is the fixed agent_name the orchestrator uses when it marks team
  // notifications as read (see backend/routers/notifications.py mark_read endpoint).
  // It is a constant string, independent of team ID or container name.
  const unread = notifications.filter(n => !n.read_by?.includes('master')).length
  const latest = notifications[0]

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-default)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Bar row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {/* Bell + badge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Bell size={14} color="var(--text-secondary)" />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--color-danger)', color: '#fff',
              fontSize: 9, fontWeight: 700, borderRadius: 999,
              padding: '0 3px', minWidth: 14, textAlign: 'center', lineHeight: '14px',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>

        {/* Latest notification text */}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {latest
            ? <><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{latest.from}</span>{': '}{latest.subject}</>
            : <span style={{ color: 'var(--text-disabled)' }}>No agent notifications</span>
          }
        </span>

        {/* Expand chevron */}
        {expanded
          ? <ChevronUp size={12} color="var(--text-secondary)" />
          : <ChevronDown size={12} color="var(--text-secondary)" />
        }
      </div>

      {/* Expanded list */}
      {expanded && (
        <div style={{ maxHeight: 180, overflowY: 'auto', borderTop: '1px solid var(--border-muted)' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-disabled)' }}>
              No notifications yet.
            </div>
          ) : notifications.slice(0, 5).map(n => (
            <div key={n.id} style={{
              display: 'flex', gap: 8, padding: '7px 14px',
              borderBottom: '1px solid var(--border-muted)',
              background: n.read_by?.includes('master') ? 'transparent' : 'rgba(88,166,255,0.05)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: n.read_by?.includes('master') ? 'var(--text-disabled)' : 'var(--accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.from}</span>
                  {' → '}{n.to}
                  {n.timestamp && !isNaN(new Date(n.timestamp).getTime()) && (
                    <span style={{ marginLeft: 6, color: 'var(--text-disabled)' }}>
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.subject}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
