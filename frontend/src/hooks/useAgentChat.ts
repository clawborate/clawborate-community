'use client'
/**
 * useAgentChat — shared chat hook for all three chat surfaces.
 *
 * Loads chat history via REST on mount, then streams tokens via the
 * WebSocket proxy.  Optionally tracks unread messages for MasterChat.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentWS } from '@/lib/ws'
import type { WsStatus } from '@/lib/ws'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import type { ChatMessage } from '@/types/chat'

export interface UseChatOptions {
  teamId: string
  agentId: string
  /** If true, also fetches the unread count and exposes divider / markRead. */
  trackUnread?: boolean
}

export interface UseChatReturn {
  messages: ChatMessage[]
  send: (content: string, images?: string[]) => void
  /** Send a chat.interrupt to abort the current in-progress stream. */
  interrupt: () => void
  wsStatus: WsStatus
  isTyping: boolean
  /** Append extra messages (e.g. surfaced sub-agent notifications). */
  addMessages: (msgs: ChatMessage[]) => void
  clearMessages: () => void
  // Unread tracking (only meaningful when trackUnread=true)
  unreadCount: number
  dividerBeforeId: string | null
  markRead: () => void
}

export function useAgentChat({
  teamId,
  agentId,
  trackUnread = false,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')
  const [unreadCount, setUnreadCount] = useState(0)
  const [dividerBeforeId, setDividerBeforeId] = useState<string | null>(null)

  const wsRef = useRef<AgentWS | null>(null)
  const replyIdRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const seenKey = `chat-seen-${teamId}-${agentId}`
  const isMaster = agentId.startsWith('master-')
  const msgRole: ChatMessage['role'] = isMaster ? 'master' : 'agent'

  // Keep messagesRef in sync so cleanup can read current count without stale closure
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── History load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const historyReq = isMaster
      ? api.getMasterChatHistory(teamId)
      : api.getAgentChatHistory(teamId, agentId)

    const reqs: [typeof historyReq, Promise<{ count: number }>?] = trackUnread
      ? [historyReq, api.getUnreadCount(teamId)]
      : [historyReq]

    Promise.all(reqs)
      .then(([histData, unreadData]) => {
        const loaded: ChatMessage[] = histData.history.map((h, i) => ({
          id: `hist-${i}`,
          role: h.role as ChatMessage['role'],
          content: h.content,
          timestamp: new Date(h.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          }),
          images: (h as { images?: string[] }).images,
        }))
        setMessages(loaded)

        if (trackUnread && unreadData && unreadData.count > 0) {
          setUnreadCount(unreadData.count)
          const masterMsgs = loaded.filter(m => m.role === 'master')
          const firstUnread = masterMsgs[masterMsgs.length - unreadData.count]
          if (firstUnread) setDividerBeforeId(firstUnread.id)
        } else if (trackUnread && unreadData && unreadData.count === 0) {
          // Initialise cursor on first open (or keep it current when nothing is unread)
          api.markChatRead(teamId).catch(() => {})
        } else if (!trackUnread) {
          // For agent chats: show divider before messages that arrived while away
          const lastSeen = parseInt(sessionStorage.getItem(seenKey) ?? '0', 10)
          if (lastSeen > 0 && loaded.length > lastSeen) {
            setDividerBeforeId(loaded[lastSeen].id)
          }
          // Initialise seen count to current history length on first load
          sessionStorage.setItem(seenKey, String(loaded.length))
        }
      })
      .catch(() => { /* backend unavailable — start with empty history */ })
  }, [teamId, agentId, isMaster, trackUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new AgentWS()
    wsRef.current = ws

    const offReconnecting = ws.on('reconnecting', () => setWsStatus('reconnecting'))
    const offClose       = ws.on('close',        () => setWsStatus('closed'))

    const offMessage = ws.on('message', (raw: unknown) => {
      const msg = raw as { event: string; data: Record<string, unknown> }

      // ── Status events from the proxy ──────────────────────────────────────
      if (msg.event === 'status') {
        if (msg.data.status === 'connected')     setWsStatus('open')
        if (msg.data.status === 'reconnecting')  setWsStatus('reconnecting')
        return
      }

      // ── Streaming token ───────────────────────────────────────────────────
      if (msg.event === 'token') {
        const content = msg.data.content as string
        if (!replyIdRef.current) {
          const rid = Date.now().toString()
          replyIdRef.current = rid
          setIsTyping(false)
          setMessages(prev => [...prev, { id: rid, role: msgRole, content, timestamp: formatTime() }])
        } else {
          const rid = replyIdRef.current
          setMessages(prev => prev.map(m => m.id === rid ? { ...m, content: m.content + content } : m))
        }
      }

      // ── Done event ────────────────────────────────────────────────────────
      if (msg.event === 'done') {
        const reply      = msg.data.reply as string
        const dispatched = msg.data.dispatched as { to: string; task: string; description: string }[] | undefined
        if (!replyIdRef.current) {
          const rid = Date.now().toString()
          replyIdRef.current = rid
          setMessages(prev => [...prev, {
            id: rid, role: msgRole,
            content: reply || '',
            timestamp: formatTime(),
            dispatched: dispatched?.length ? dispatched : undefined,
          }])
        } else {
          const rid = replyIdRef.current
          setMessages(prev => prev.map(m => m.id === rid ? {
            ...m,
            content: reply || m.content,
            dispatched: dispatched?.length ? dispatched : undefined,
          } : m))
        }
        replyIdRef.current = null
        setIsTyping(false)
      }

      // ── Interrupted event (user stopped the stream) ───────────────────────
      if (msg.event === 'interrupted') {
        const partial = msg.data.partial as string
        if (replyIdRef.current) {
          const rid = replyIdRef.current
          setMessages(prev => prev.map(m => m.id === rid
            ? { ...m, content: (partial || m.content) + ' [stopped]' }
            : m
          ))
        } else if (partial) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(), role: msgRole,
            content: partial + ' [stopped]',
            timestamp: formatTime(),
          }])
        }
        replyIdRef.current = null
        setIsTyping(false)
      }

      // ── Notification push (sub-agent → master, no polling needed) ────────
      if (msg.event === 'notification') {
        const n = msg.data as { id: string; from: string; subject?: string; content?: { summary?: string; details?: string }; message?: string; timestamp: string }
        const content = n.content
          ? [n.content.summary, n.content.details].filter(Boolean).join('\n\n')
          : n.message || n.subject || ''
        setMessages(prev => {
          if (prev.some(m => m.id === `notif-${n.id}`)) return prev
          return [...prev, {
            id: `notif-${n.id}`,
            role: 'agent' as const,
            content,
            timestamp: new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            agentName: n.from,
          }]
        })
        return
      }

      // ── Error event ───────────────────────────────────────────────────────
      if (msg.event === 'error') {
        const error = msg.data.error as string
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: msgRole,
          content: `Connection error: ${error}`,
          timestamp: formatTime(), isError: true,
        }])
        replyIdRef.current = null
        setIsTyping(false)
      }
    })

    ws.connect(teamId, agentId)

    return () => {
      offReconnecting(); offClose(); offMessage()
      ws.disconnect()
      wsRef.current = null
      if (trackUnread) {
        // Auto mark-read on close — no manual pill click needed
        api.markChatRead(teamId).catch(() => {})
      } else {
        // Save current message count so we can show divider on next visit
        sessionStorage.setItem(seenKey, String(messagesRef.current.length))
      }
    }
  }, [teamId, agentId, msgRole]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────────────────
  const send = useCallback((content: string, images?: string[]) => {
    if ((!content.trim() && !images?.length) || isTyping) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user', content,
      timestamp: formatTime(),
      images: images?.length ? images : undefined,
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    replyIdRef.current = null
    wsRef.current?.send('chat.send', {
      content,
      ...(images?.length ? { images } : {}),
    })
  }, [isTyping])

  const interrupt = useCallback(() => {
    wsRef.current?.send('chat.interrupt', {})
  }, [])

  const addMessages = useCallback((newMsgs: ChatMessage[]) => {
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id))
      const fresh = newMsgs.filter(m => !existingIds.has(m.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  const markRead = useCallback(() => {
    api.markChatRead(teamId).catch(() => {})
    setUnreadCount(0)
    setDividerBeforeId(null)
  }, [teamId])

  return { messages, send, interrupt, wsStatus, isTyping, addMessages, clearMessages, unreadCount, dividerBeforeId, markRead }
}
