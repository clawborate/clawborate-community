'use client'
/**
 * WsStatusBar — Ella's Option B enhanced design.
 *
 * Reconnecting: amber inline banner with pulsing dot.
 * Restored:     brief "Connection restored" toast for 1.5 s.
 * Connected / Connecting: renders nothing.
 */
import { useEffect, useRef, useState } from 'react'
import type { WsStatus } from '@/lib/ws'

interface Props {
  status: WsStatus
  lang?: 'en' | 'zh'
}

export default function WsStatusBar({ status, lang = 'en' }: Props) {
  const prevRef = useRef<WsStatus>(status)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    // When transitioning from reconnecting → open, show the restored toast
    if (prevRef.current === 'reconnecting' && status === 'open') {
      setShowRestored(true)
      const t = setTimeout(() => setShowRestored(false), 1_500)
      return () => clearTimeout(t)
    }
    prevRef.current = status
  }, [status])

  if (showRestored) {
    return (
      <div style={{ padding: '4px 16px', background: 'rgba(63,185,80,0.08)', borderBottom: '1px solid rgba(63,185,80,0.2)', fontSize: 11, color: '#3FB950', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>✓</span>
        <span>{lang === 'zh' ? '连接已恢复' : 'Connection restored'}</span>
      </div>
    )
  }

  if (status === 'reconnecting') {
    return (
      <div style={{ padding: '4px 16px', background: 'rgba(210,153,34,0.08)', borderBottom: '1px solid rgba(210,153,34,0.2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#D29922' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D29922', animation: 'ws-pulse 0.8s ease-in-out infinite' }} />
        <span>{lang === 'zh' ? '重新连接中...' : 'Reconnecting...'}</span>
        <style>{`
          @keyframes ws-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
        `}</style>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div style={{ padding: '4px 16px', background: 'rgba(248,81,73,0.08)', borderBottom: '1px solid rgba(248,81,73,0.2)', fontSize: 11, color: '#F85149' }}>
        {lang === 'zh' ? '连接已断开' : 'Disconnected'}
      </div>
    )
  }

  return null
}
