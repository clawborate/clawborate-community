'use client'
/**
 * ChatPanel — full composable chat surface used by MasterChat, AgentDrawer,
 * and the Full Details page.
 *
 * Composes: useAgentChat hook + WsStatusBar + message list + ChatBubble +
 *           TypingIndicator + ChatQuickBar + ChatInput.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { useAgentChat } from '@/hooks/useAgentChat'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'
import TypingIndicator from './TypingIndicator'
import WsStatusBar from './WsStatusBar'
import ChatQuickBar from './ChatQuickBar'
import { useLang } from '@/hooks/useLang'
import { getT } from '@/lib/locales'
import type { ChatMessage } from '@/types/chat'

interface Props {
  teamId: string
  agentId: string
  withImages?: boolean
  extraHeader?: ReactNode
  /** Extra messages to surface in the list (e.g. sub-agent notifications). */
  extraMessages?: ChatMessage[]
  /** Called whenever the message list changes — used by MasterChat for unread. */
  onMessagesChange?: (msgs: ChatMessage[]) => void
  /** Divider rendered before this message ID — only used when trackUnread=false. */
  dividerBeforeId?: string | null
  dividerRef?: React.RefObject<HTMLDivElement>
  emptyText?: string
  emptyHint?: string
  inputMaxHeight?: number
  /**
   * When true, ChatPanel owns the unread state and exposes it via callbacks
   * so the parent (MasterChat) does not need a second useAgentChat call.
   */
  trackUnread?: boolean
  /** Called when unread count or markRead changes (only when trackUnread=true). */
  onUnreadChange?: (count: number, markRead: () => void) => void
  /** Called once with the clearMessages fn so parent can clear on demand. */
  onClearReady?: (clearFn: () => void) => void
  /** Called whenever the divider is set/cleared; passes a fn that scrolls to it. */
  onScrollToUnreadReady?: (scrollFn: () => void) => void
}

export default function ChatPanel({
  teamId, agentId,
  withImages = false, extraHeader,
  extraMessages, onMessagesChange,
  dividerBeforeId: dividerBeforeIdProp, dividerRef: dividerRefProp,
  emptyText, emptyHint,
  inputMaxHeight = 120,
  trackUnread = false,
  onUnreadChange, onClearReady, onScrollToUnreadReady,
}: Props) {
  const { lang } = useLang()
  const t = getT(lang)

  const [inputVal, setInputVal] = useState('')
  const [images, setImages] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const internalDividerRef = useRef<HTMLDivElement>(null)
  const hasScrolledToDivider = useRef(false)

  const [autoExecute, setAutoExecute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('clawborate-auto-execute') !== '0'
  })

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'clawborate-auto-execute') {
        setAutoExecute(e.newValue !== '0')
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const { messages, send, interrupt, wsStatus, isTyping, addMessages, clearMessages,
          unreadCount, dividerBeforeId: unreadDivider, markRead } =
    useAgentChat({ teamId, agentId, trackUnread })

  // Prefer explicit prop; fall back to hook's internal state (covers sessionStorage-based divider)
  const dividerBeforeId = dividerBeforeIdProp ?? unreadDivider
  const dividerRef      = dividerBeforeIdProp ? dividerRefProp : internalDividerRef

  // Expose unread state to parent
  useEffect(() => {
    if (trackUnread) onUnreadChange?.(unreadCount, markRead)
  }, [unreadCount, markRead, trackUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose clearMessages to parent on mount (stable ref)
  useEffect(() => {
    if (trackUnread) onClearReady?.(clearMessages)
  }, [clearMessages, trackUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose scroll-to-unread fn whenever divider changes
  useEffect(() => {
    onScrollToUnreadReady?.(() => {
      dividerRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [dividerBeforeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Surface extra messages (e.g. sub-agent notifications), dedup by id
  useEffect(() => {
    if (extraMessages?.length) addMessages(extraMessages)
  }, [extraMessages, addMessages])

  // Notify parent about message changes
  useEffect(() => {
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])

  // Auto-scroll: to divider on initial load, then to bottom for new messages
  useEffect(() => {
    if (!hasScrolledToDivider.current && dividerBeforeId && dividerRef?.current) {
      dividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      hasScrolledToDivider.current = true
    } else if (hasScrolledToDivider.current || !dividerBeforeId) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, dividerBeforeId, dividerRef])

  const handleSend = useCallback((overrideText?: string) => {
    const text = overrideText ?? inputVal
    send(text, withImages ? images : undefined)
    if (!overrideText) {
      setInputVal('')
      setImages([])
    }
  }, [inputVal, images, send, withImages])

  const isConnectionDisabled = wsStatus === 'reconnecting' || wsStatus === 'closed'
  const isInputDisabled = isTyping || isConnectionDisabled
  const statusText = wsStatus === 'reconnecting'
    ? (lang === 'zh' ? '重新连接中...' : 'Reconnecting...')
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {extraHeader}
      <WsStatusBar status={wsStatus} lang={lang} />

      {/* Message list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && !isTyping ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: 8 }}>
            <Bot size={32} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>{emptyText ?? t.chat.empty}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{emptyHint ?? t.chat.emptyHint}</div>
          </div>
        ) : messages.filter(m => m.role === 'user' || m.content).map(msg => (
          <div key={msg.id}>
            {dividerBeforeId === msg.id && (
              <div ref={dividerRef} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', color: '#F85149', fontSize: 11 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(248,81,73,0.3)' }} />
                <span style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{t.chat.unreadDivider}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(248,81,73,0.3)' }} />
              </div>
            )}
            <ChatBubble msg={msg} lang={lang} autoExecute={autoExecute} />
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick bar */}
      <ChatQuickBar onSendMessage={handleSend} lang={lang} disabled={isInputDisabled} />

      {/* Input */}
      <ChatInput
        value={inputVal}
        onChange={setInputVal}
        onSend={handleSend}
        isTyping={isTyping}
        onInterrupt={interrupt}
        disabled={wsStatus === 'reconnecting' || wsStatus === 'closed'}
        statusText={statusText}
        withImages={withImages}
        attachedImages={images}
        onAttach={withImages ? (imgs) => setImages(prev => [...prev, ...imgs].slice(0, 3)) : undefined}
        onRemoveImage={withImages ? (i) => setImages(prev => prev.filter((_, j) => j !== i)) : undefined}
        placeholder={t.chat.placeholder}
        maxHeight={inputMaxHeight}
      />

      <style>{`
        .markdown-body { font-size: 13px; line-height: 1.6; color: var(--text-primary); }
        .markdown-body h1,.markdown-body h2,.markdown-body h3 { font-weight:600; margin:8px 0 4px; color:var(--text-primary); }
        .markdown-body h1 { font-size:15px; } .markdown-body h2 { font-size:14px; } .markdown-body h3 { font-size:13px; }
        .markdown-body p { margin:4px 0; }
        .markdown-body ul,.markdown-body ol { margin:4px 0; padding-left:20px; }
        .markdown-body li { margin:2px 0; }
        .markdown-body strong { font-weight:600; } .markdown-body em { font-style:italic; }
        .markdown-body code { background:rgba(88,166,255,0.1); border-radius:3px; padding:1px 4px; font-family:monospace; font-size:12px; }
        .markdown-body pre { background:rgba(0,0,0,0.2); border-radius:6px; padding:10px; overflow-x:auto; margin:6px 0; }
        .markdown-body pre code { background:none; padding:0; }
        .markdown-body hr { border:none; border-top:1px solid var(--border-default); margin:8px 0; }
        .markdown-body blockquote { border-left:3px solid var(--accent); padding-left:10px; margin:4px 0; color:var(--text-secondary); }
      `}</style>
    </div>
  )
}
