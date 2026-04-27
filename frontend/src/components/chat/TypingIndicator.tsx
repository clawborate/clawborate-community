import { Bot } from 'lucide-react'

interface Props {
  size?: 'sm' | 'md'
}

export default function TypingIndicator({ size = 'md' }: Props) {
  const iconSize   = size === 'sm' ? 12 : 14
  const avatarSize = size === 'sm' ? 22 : 24
  const dotSize    = size === 'sm' ? 5  : 6
  const gap        = size === 'sm' ? 3  : 4
  const padding    = size === 'sm' ? '10px 14px' : '12px 16px'

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: 'rgba(88,166,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Bot size={iconSize} color="var(--accent)" />
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '0 10px 10px 10px', padding, display: 'flex', gap, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: 'var(--text-disabled)', animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%            { opacity: 1;   transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}
