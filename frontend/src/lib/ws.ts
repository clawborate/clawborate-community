/**
 * AgentWS — WebSocket client for the OpenClaw agent chat proxy.
 *
 * Connects to /api/ws/teams/{teamId}/agents/{agentId} and handles:
 *   - Transport-level reconnect with exponential back-off (1 s → 30 s max)
 *   - Forwarding of all WS events to registered handlers
 *
 * Container-level reconnect (proxy can't reach OpenClaw) is signalled by
 * status events injected by the backend proxy — consumers should watch for
 * event === 'status' with data.status === 'reconnecting'.
 */

export type WsStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

type Handler = (...args: unknown[]) => void

export class AgentWS {
  private ws: WebSocket | null = null
  private readonly handlers = new Map<string, Handler[]>()
  private retryDelay = 1_000
  private readonly maxRetryDelay = 30_000
  private shouldReconnect = false
  private teamId = ''
  private agentId = ''

  connect(teamId: string, agentId: string): void {
    this.teamId = teamId
    this.agentId = agentId
    this.shouldReconnect = true
    this._connect()
  }

  private _connect(): void {
    const url = _wsUrl(`/api/ws/teams/${this.teamId}/agents/${this.agentId}`)
    if (!url) return  // SSR — no WebSocket

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelay = 1_000
      this._emit('open')
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as unknown
        this._emit('message', msg)
      } catch { /* ignore malformed frames */ }
    }

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this._emit('reconnecting')
        setTimeout(() => { if (this.shouldReconnect) this._connect() }, this.retryDelay)
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay)
      } else {
        this._emit('close')
      }
    }
  }

  send(method: string, params: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method, params }))
    }
  }

  /** Register a handler and return a cleanup function. */
  on(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
    return () => {
      const arr = this.handlers.get(event) ?? []
      const idx = arr.indexOf(handler)
      if (idx > -1) arr.splice(idx, 1)
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.ws?.close()
    this.ws = null
  }

  private _emit(event: string, data?: unknown): void {
    this.handlers.get(event)?.forEach(h => h(data))
  }
}

/**
 * UnreadWS — lightweight WebSocket for push-based unread count in TeamCard.
 *
 * Connects to /api/ws/teams/{teamId}/unread.
 * Backend pushes {"event": "unread", "data": {"count": N}} whenever the count
 * changes (watches file mtime, ~2 s latency). No messages sent to server.
 * Reconnects with exponential back-off (5 s → 60 s, max 10 attempts).
 */
export class UnreadWS {
  private ws: WebSocket | null = null
  private shouldConnect = false
  private teamId = ''
  private onCount: (count: number) => void = () => {}
  private retryDelay = 5_000
  private readonly maxRetryDelay = 60_000
  private retries = 0
  private readonly maxRetries = 10

  connect(teamId: string, onCount: (count: number) => void): void {
    this.teamId = teamId
    this.onCount = onCount
    this.shouldConnect = true
    this.retryDelay = 5_000
    this.retries = 0
    this._connect()
  }

  private _connect(): void {
    const url = _wsUrl(`/api/ws/teams/${this.teamId}/unread`)
    if (!url) return  // SSR

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelay = 5_000
      this.retries = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { event: string; data: { count: number } }
        if (msg.event === 'unread') this.onCount(msg.data.count)
      } catch { /* ignore malformed frames */ }
    }

    this.ws.onclose = () => {
      if (this.shouldConnect && this.retries < this.maxRetries) {
        this.retries += 1
        setTimeout(() => { if (this.shouldConnect) this._connect() }, this.retryDelay)
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay)
      }
    }
  }

  disconnect(): void {
    this.shouldConnect = false
    this.ws?.close()
    this.ws = null
  }
}

/**
 * GlobalUnreadWS — single WebSocket for push-based unread counts across ALL teams.
 *
 * Connects to /api/ws/unread.
 * Backend pushes {"event": "unread_all", "data": {"team-abc": 3, "team-xyz": 0}}
 * whenever any team's unread count changes (~2 s latency). No messages sent to server.
 * Reconnects with exponential back-off (5 s → 60 s, max 10 attempts).
 */
export class GlobalUnreadWS {
  private ws: WebSocket | null = null
  private shouldConnect = false
  private onCounts: (counts: Record<string, number>) => void = () => {}
  private retryDelay = 5_000
  private readonly maxRetryDelay = 60_000
  private retries = 0
  private readonly maxRetries = 10
  private cachedToken: string | null = null

  connect(onCounts: (counts: Record<string, number>) => void): void {
    this.onCounts = onCounts
    this.shouldConnect = true
    this.retryDelay = 5_000
    this.retries = 0
    // Fetch the token via /api/auth/ws-token (server-side reads httpOnly cookie),
    // then open the WebSocket with ?token= query param. The browser WebSocket API
    // cannot set custom Authorization headers on the upgrade request.
    this._fetchTokenAndConnect()
  }

  private _fetchTokenAndConnect(): void {
    if (typeof window === 'undefined') return  // SSR
    fetch('/api/auth/ws-token')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { token: string }) => {
        this.cachedToken = data.token
        if (this.shouldConnect) this._connect()
      })
      .catch(() => {
        // Token fetch failed — connect without token (backend will reject with 4001)
        if (this.shouldConnect) this._connect()
      })
  }

  private _connect(): void {
    const path = this.cachedToken
      ? `/api/ws/unread?token=${encodeURIComponent(this.cachedToken)}`
      : '/api/ws/unread'
    const url = _wsUrl(path)
    if (!url) return

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelay = 5_000
      this.retries = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { event: string; data: Record<string, number> }
        if (msg.event === 'unread_all') this.onCounts(msg.data)
      } catch { /* ignore malformed frames */ }
    }

    this.ws.onclose = () => {
      if (this.shouldConnect && this.retries < this.maxRetries) {
        this.retries += 1
        // Clear cached token so reconnect fetches a fresh one (may have been refreshed)
        this.cachedToken = null
        setTimeout(() => { if (this.shouldConnect) this._fetchTokenAndConnect() }, this.retryDelay)
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay)
      }
    }
  }

  disconnect(): void {
    this.shouldConnect = false
    this.ws?.close()
    this.ws = null
  }
}

/**
 * NotificationWS — WebSocket client for real-time team notification push.
 *
 * Connects to /api/ws/teams/{teamId}/notifications.
 * Backend pushes {"event": "notifications", "data": [...notifications...]} on
 * connect and whenever team_notifications.json changes (~2 s latency).
 * Reconnects with exponential back-off (5 s → 60 s, max 10 attempts).
 */

interface NotificationItem {
  id: string
  from: string
  to: string
  subject: string
  message: string
  type?: string
  timestamp: string
  read_by: string[]
}

export class NotificationWS {
  private ws: WebSocket | null = null
  private shouldConnect = false
  private teamId = ''
  private onNotifications: (items: NotificationItem[]) => void = () => {}
  private retryDelay = 5_000
  private readonly maxRetryDelay = 60_000
  private retries = 0
  private readonly maxRetries = 10
  private cachedToken: string | null = null

  connect(teamId: string, onNotifications: (items: NotificationItem[]) => void): void {
    this.teamId = teamId
    this.onNotifications = onNotifications
    this.shouldConnect = true
    this.retryDelay = 5_000
    this.retries = 0
    this._fetchTokenAndConnect()
  }

  private _fetchTokenAndConnect(): void {
    if (typeof window === 'undefined') return  // SSR
    fetch('/api/auth/ws-token')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { token: string }) => {
        this.cachedToken = data.token
        if (this.shouldConnect) this._connect()
      })
      .catch(() => {
        if (this.shouldConnect) this._connect()
      })
  }

  private _connect(): void {
    const path = this.cachedToken
      ? `/api/ws/teams/${this.teamId}/notifications?token=${encodeURIComponent(this.cachedToken)}`
      : `/api/ws/teams/${this.teamId}/notifications`
    const url = _wsUrl(path)
    if (!url) return

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelay = 5_000
      this.retries = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { event: string; data: NotificationItem[] }
        if (msg.event === 'notifications') this.onNotifications(msg.data)
      } catch { /* ignore malformed frames */ }
    }

    this.ws.onclose = () => {

      if (this.shouldConnect && this.retries < this.maxRetries) {
        this.retries += 1
        this.cachedToken = null
        setTimeout(() => { if (this.shouldConnect) this._fetchTokenAndConnect() }, this.retryDelay)
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay)
      }
    }
  }

  disconnect(): void {
    this.shouldConnect = false
    this.ws?.close()
    this.ws = null
  }
}

/** Derive a ws:// / wss:// URL for a given path.
 *
 * In dev: reads NEXT_PUBLIC_SSE_BASE (e.g. "http://localhost:8000") and
 *         replaces the scheme.
 * In prod: uses window.location.host with the same protocol as the page.
 */
function _wsUrl(path: string): string {
  if (typeof window === 'undefined') return ''  // SSR

  const base = process.env.NEXT_PUBLIC_SSE_BASE
  if (base) {
    return base.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws') + path
  }
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}${path}`
}
