'use client'
import { useRef } from 'react'
import { Send, Paperclip, X, Square } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  /** When true, show a Stop button instead of Send (agent is streaming). */
  isTyping?: boolean
  /** Called when the user clicks the Stop button. */
  onInterrupt?: () => void
  disabled?: boolean
  /** Overlay text shown inside the input when disabled (e.g. "Reconnecting...") */
  statusText?: string
  withImages?: boolean
  attachedImages?: string[]
  onAttach?: (newImages: string[]) => void
  onRemoveImage?: (index: number) => void
  placeholder?: string
  maxHeight?: number
}

export default function ChatInput({
  value, onChange, onSend,
  isTyping = false, onInterrupt,
  disabled = false, statusText,
  withImages = false,
  attachedImages = [], onAttach, onRemoveImage,
  placeholder = 'Send a message...',
  maxHeight = 120,
}: Props) {
  const taRef       = useRef<HTMLTextAreaElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)

  const autoResize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !onAttach) return
    const remaining = 3 - attachedImages.length
    const loaded: string[] = []
    files.slice(0, remaining).forEach(file => {
      if (file.size > 5 * 1024 * 1024) return
      const reader = new FileReader()
      reader.onload = () => {
        loaded.push(reader.result as string)
        if (loaded.length === Math.min(files.slice(0, remaining).filter(f => f.size <= 5 * 1024 * 1024).length, remaining)) {
          onAttach(loaded)
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const canSend = (value.trim() || attachedImages.length > 0) && !disabled

  return (
    <div style={{ background: 'var(--bg-surface)', flexShrink: 0 }}>
      {/* Image preview strip */}
      {withImages && attachedImages.length > 0 && (
        <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachedImages.map((img, i) => (
            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-default)', display: 'block' }} />
              {onRemoveImage && (
                <button onClick={() => onRemoveImage(i)}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={10} color="var(--text-secondary)" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {withImages && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled || attachedImages.length >= 3}
              style={{ width: 32, height: 32, borderRadius: 8, background: 'none', border: '1px solid var(--border-default)', cursor: disabled || attachedImages.length >= 3 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled || attachedImages.length >= 3 ? 0.4 : 1 }}>
              <Paperclip size={14} color="var(--text-secondary)" />
            </button>
          </>
        )}

        {/* Textarea + optional reconnect overlay */}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={taRef}
            value={value}
            onChange={e => { onChange(e.target.value); autoResize() }}
            onKeyDown={handleKey}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            style={{ width: '100%', minHeight: 36, maxHeight, resize: 'none', background: 'var(--bg-base)', border: `1px solid ${disabled ? 'var(--border-muted, var(--border-default))' : 'var(--border-default)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', boxSizing: 'border-box' }}
            onFocus={e => !disabled && (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = disabled ? 'var(--border-default)' : 'var(--border-default)')}
          />
          {disabled && statusText && (
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-disabled)', pointerEvents: 'none', animation: 'status-pulse 0.8s ease-in-out infinite', whiteSpace: 'nowrap' }}>
              {statusText}
              <style>{`
                @keyframes status-pulse {
                  0%, 100% { opacity: 1; }
                  50%       { opacity: 0.4; }
                }
              `}</style>
            </span>
          )}
        </div>

        {isTyping ? (
          /* Stop button — shown while agent is streaming */
          <button
            onClick={onInterrupt}
            title="Stop generating"
            style={{ width: 32, height: 32, borderRadius: 8, background: '#c0392b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e74c3c'; e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.transform = 'scale(1)' }}>
            <Square size={13} color="#ffffff" fill="#ffffff" />
          </button>
        ) : (
          /* Send button — default state */
          <button
            onClick={onSend}
            disabled={!canSend}
            style={{ width: 32, height: 32, borderRadius: '50%', background: canSend ? 'var(--accent)' : 'var(--bg-surface)', border: canSend ? 'none' : '1px solid var(--border-default)', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.15s, background 0.15s', opacity: canSend ? 1 : 0.4 }}
            onMouseEnter={e => { if (canSend) e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
            <Send size={14} color={canSend ? '#ffffff' : 'var(--text-disabled)'} />
          </button>
        )}
      </div>
    </div>
  )
}
