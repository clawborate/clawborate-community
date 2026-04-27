import { useState } from 'react'
import { Bot } from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { ChatMessage } from '@/types/chat'
import type { Lang } from '@/lib/locales'

interface Props {
  msg: ChatMessage
  lang?: Lang
  autoExecute?: boolean
}

export default function ChatBubble({ msg, lang = 'en', autoExecute = true }: Props) {
  const [authorized, setAuthorized] = useState(false)

  // ── Notification card ────────────────────────────────────────────────────
  if (msg.type === 'notification') {
    const showAuthorize = !autoExecute && msg.requiresLlm && !authorized
    const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : msg.timestamp
    return (
      <div style={{
        background: 'rgba(88,166,255,.06)',
        border: '1px solid rgba(88,166,255,.18)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 8,
        padding: '10px 13px',
        fontSize: 12,
        maxWidth: '88%',
        alignSelf: 'flex-start',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(88,166,255,.12)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Notification
          </span>
          {msg.agentName && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{msg.agentName}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-disabled)' }}>{ts}</span>
        </div>
        <div style={{ color: 'var(--text-primary)', lineHeight: 1.55, fontSize: 12 }}>{msg.content}</div>
        {showAuthorize && (
          <div style={{ marginTop: 9, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setAuthorized(true)}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600, padding: '5px 11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9"/></svg>
              Authorize
            </button>
          </div>
        )}
        {authorized && (
          <div style={{ marginTop: 9, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>✓ Authorized</span>
          </div>
        )}
      </div>
    )
  }

  const isUser   = msg.role === 'user'
  const isAgent  = msg.role === 'agent'
  const isMaster = msg.role === 'master'

  const iconColor = msg.isError ? '#F85149' : isAgent ? '#3FB950' : 'var(--accent)'
  const iconBg    = msg.isError ? 'rgba(248,81,73,0.12)' : isAgent ? 'rgba(63,185,80,0.12)' : 'rgba(88,166,255,0.12)'

  const bubbleBg = isUser
    ? 'var(--accent)'
    : msg.isError ? 'rgba(248,81,73,0.08)'
    : isAgent ? 'rgba(63,185,80,0.06)'
    : 'var(--bg-card)'

  const bubbleBorder = isUser ? 'none'
    : `1px solid ${msg.isError ? 'rgba(248,81,73,0.3)' : isAgent ? 'rgba(63,185,80,0.25)' : 'var(--border-default)'}`

  const textColor = isUser ? '#ffffff' : msg.isError ? '#F85149' : 'var(--text-primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: isUser ? 'row-reverse' : 'row', alignSelf: 'stretch' }}>
        {!isUser && (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            <Bot size={14} color={iconColor} />
          </div>
        )}
        <div style={{
          maxWidth: '80%', background: bubbleBg, border: bubbleBorder,
          borderRadius: isUser ? '10px 0 10px 10px' : '0 10px 10px 10px',
          padding: '10px 14px', fontSize: 13, color: textColor,
          lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
        }}>
          {isAgent && msg.agentName && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#3FB950', marginBottom: 4 }}>
              {msg.agentName} → Master
            </div>
          )}
          {isUser && msg.images && msg.images.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: msg.content ? 8 : 0 }}>
              {msg.images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" style={{ height: 80, maxWidth: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' }} />
              ))}
            </div>
          )}
          {(isMaster || isAgent) && !msg.isError
            ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content, { async: false }) as string) }} />
            : msg.content}
          {msg.dispatched && msg.dispatched.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {msg.dispatched.map((d, i) => (
                <div key={i} style={{ background: 'rgba(88,166,255,0.08)', borderLeft: '3px solid #58A6FF', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>➡️</span>
                  <span>{lang === 'zh' ? `已分派给 ${d.to}` : `Dispatched to ${d.to}`}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>|</span>
                  <span style={{ color: 'var(--text-primary)' }}>{d.task}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-disabled)', paddingLeft: !isUser ? 32 : 0, textAlign: isUser ? 'right' : 'left' }}>
        {msg.timestamp}
      </div>
    </div>
  )
}
