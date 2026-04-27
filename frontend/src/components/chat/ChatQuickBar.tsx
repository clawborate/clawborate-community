'use client'
import { Bell, Send } from 'lucide-react'

interface Props {
  onSendMessage: (text: string) => void
  lang?: 'en' | 'zh'
  disabled?: boolean
}

export default function ChatQuickBar({ onSendMessage, lang = 'en', disabled }: Props) {
  const isZh = lang === 'zh'

  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'var(--bg-surface)' }}>
      <button
        onClick={() => onSendMessage(isZh ? '接收通知' : 'Check notifications')}
        disabled={disabled}
        title={isZh ? '接收通知' : 'Check notifications'}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: '3px 8px', cursor: disabled ? 'default' : 'pointer',
          fontSize: 11, color: 'var(--text-secondary)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Bell size={12} />
        <span>{isZh ? '接收通知' : 'Check notifications'}</span>
      </button>

      <button
        onClick={() => onSendMessage(isZh ? '发送通知' : 'Send notification')}
        disabled={disabled}
        title={isZh ? '发送通知' : 'Send notification'}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: '3px 8px', cursor: disabled ? 'default' : 'pointer',
          fontSize: 11, color: 'var(--text-secondary)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Send size={12} />
        <span>{isZh ? '发送通知' : 'Send notification'}</span>
      </button>
    </div>
  )
}
