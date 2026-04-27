import type { AgentStatus } from '@/types'

const CFG: Record<AgentStatus, { color: string; bg: string; icon: string }> = {
  running:  { color: '#3FB950', bg: 'rgba(63,185,80,0.12)',   icon: '●' },
  stopped:  { color: '#6E7681', bg: 'rgba(110,118,129,0.12)', icon: '○' },
  exited:   { color: '#D29922', bg: 'rgba(210,153,34,0.12)',  icon: '⚠' },
  dead:     { color: '#F85149', bg: 'rgba(248,81,73,0.12)',   icon: '✕' },
  starting: { color: '#58A6FF', bg: 'rgba(88,166,255,0.12)',  icon: '↺' },
}

export default function StatusBadge({ status, label, small }: { status: AgentStatus; label?: string; small?: boolean }) {
  const cfg = CFG[status] || CFG.stopped
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, borderRadius: 4, fontWeight: 500, fontSize: small ? 11 : 12, padding: small ? '2px 6px' : '4px 8px', ...(status === 'starting' ? { animation: 'blink 1.2s ease-in-out infinite' } : {}) }}>
      <span style={{ fontSize: small ? 8 : 10 }}>{cfg.icon}</span>
      {label || status}
    </span>
  )
}
