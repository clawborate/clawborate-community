'use client'
/**
 * RightChatPanel — 340px right column (M3-A2 enhanced Agent switcher).
 *
 * Enhancements in A2 vs A0:
 *   - Agent list loaded dynamically via api.getAgents() on team change,
 *     not derived from team.master / team.sub_agents (which can be stale).
 *   - Loading skeleton while agents are being fetched.
 *   - Dropdown shows per-agent status dot (running/stopped/etc.) and role.
 *   - Master agent labelled with a crown icon; clearly first in the list.
 *   - Context tag in the banner reflects the active agent's role, not just
 *     the generic "Master"/"Agent" label.
 *   - Selector button shows a chevron that rotates when the dropdown is open.
 *   - Click-outside handler closes the dropdown reliably.
 *
 * Acceptance criteria:
 *   ✅ Dropdown can open / close
 *   ✅ Shows all agents for the current team (from API, always fresh)
 *   ✅ Selecting an agent updates the chat panel (ChatPanel key reconnects WS)
 *   ✅ Defaults to master agent
 *   ✅ Switching teams resets agent selection (useEffect on team?.id)
 *
 * The border-top accent color reflects the active team (visual context cue).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Bot } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import NotificationBar from '@/components/layout/NotificationBar'
import { NotificationWS } from '@/lib/ws'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import { useTheme } from '@/hooks/useTheme'
import { teamAccent } from '@/lib/teamColor'
import type { Team, Agent } from '@/types'

// P1-14: OW URL is fetched from the backend session endpoint (no more proxy rewriting)

interface Props {
  team: Team | null
  width?: number
}

/** Dot color per agent status — matches StatusBadge palette */
const STATUS_DOT: Record<string, string> = {
  running:  '#3FB950',
  starting: '#58A6FF',
  stopped:  '#6E7681',
  exited:   '#D29922',
  dead:     '#F85149',
}

export default function RightChatPanel({ team, width = 420 }: Props) {
  const { lang } = useLang()
  const { theme } = useTheme()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  // Open WebUI auth token + base URL + per-agent chat IDs
  const [owToken, setOwToken] = useState<string | null>(null)
  const [owBaseUrl, setOwBaseUrl] = useState<string | null>(null)
  const [owError, setOwError] = useState<string | null>(null)
  // chatIds: per-agent resolved chat info; null chat_id = no history yet (use home route)
  const [chatIds, setChatIds] = useState<Record<string, string | null>>({})
  const chatIdsRef = useRef<Record<string, string | null>>({})

  // Load fresh agent list whenever team changes
  const loadAgents = useCallback(async (teamId: string) => {
    setLoadingAgents(true)
    try {
      const data = await api.getAgents(teamId)
      // Sort: master first, then sub-agents alphabetically by name
      setAgents(data.sort((a, b) => {
        if (a.is_master !== b.is_master) return a.is_master ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
    } catch {
      // Fallback: derive from team object if API fails
      if (team) {
        const fallback: Agent[] = []
        if (team.master) fallback.push(team.master)
        fallback.push(...(team.sub_agents ?? []))
        setAgents(fallback)
      }
    } finally {
      setLoadingAgents(false)
    }
  }, [team])

  // Reload agents and reset selection when team changes
  useEffect(() => {
    if (!team) {
      setAgents([])
      setSelectedAgentId(null)
      setOwToken(null)
      return
    }
    setSelectedAgentId(null)
    loadAgents(team.id)
  }, [team?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Open WebUI token whenever team changes
  useEffect(() => {
    if (!team) return
    setOwToken(null)
    setOwBaseUrl(null)
    setOwError(null)
    setChatIds({})
    chatIdsRef.current = {}
    api.getOpenWebUISession()
      .then(({ token, webui_url }) => {
        setOwToken(token)
        setOwBaseUrl(process.env.NEXT_PUBLIC_OW_URL || webui_url)
      })
      .catch(() => setOwError(lang === 'zh' ? '无法连接 Open WebUI' : 'Open WebUI unavailable'))
  }, [team?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeAgent: Agent | null = useMemo(() => {
    if (!agents.length) return team?.master ?? null
    if (selectedAgentId) return agents.find(a => a.id === selectedAgentId) ?? null
    return agents.find(a => a.is_master) ?? agents[0] ?? null
  }, [agents, selectedAgentId, team])

  // Lazily resolve chat ID for the active agent only — triggered when the user
  // switches to an agent. Avoids creating phantom empty chats for agents never visited.
  useEffect(() => {
    if (!team || !owToken || !activeAgent) return
    const agentId = activeAgent.id
    if (agentId in chatIdsRef.current) return // already resolved (even if null)
    api.getOrCreateWebUIChat(team.id, agentId)
      .then(({ chat_id }) => {
        chatIdsRef.current = { ...chatIdsRef.current, [agentId]: chat_id }
        setChatIds(prev => ({ ...prev, [agentId]: chat_id }))
      })
      .catch((err) => console.error('[webui-chat] failed:', err))
  }, [team?.id, owToken, activeAgent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-send: when the ACTIVE agent (whichever the user is chatting with)
  // receives a completion/status_update, auto-type "Team notification has
  // updates" into that agent's OW iframe. Works for any agent — master,
  // developer, designer, tester. When the user switches agents, the watcher
  // switches too. The dispatcher does NOT trigger for completions (results
  // go to throwaway sessions). Auto-send is the only reliable path.
  // Debounced: multiple completions within 15s trigger only one auto-send.
  const autoSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSendSeenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!team || !activeAgent) return

    // Reset seen-set when active agent changes
    autoSendSeenIds.current = new Set()

    const agentName = activeAgent.name?.toLowerCase() ?? ''
    const agentId = activeAgent.id?.toLowerCase() ?? ''

    const ws = new NotificationWS()
    ws.connect(team.id, (items) => {
      // Detect unread completion/status_update notifications addressed to
      // the active agent (the one the user is currently chatting with).
      const unreadCompletions = items.filter(n => {
        const to = (n.to ?? '').toLowerCase()
        const from = (n.from ?? '').toLowerCase()
        const ntype = (n.type ?? '').toLowerCase()
        const readBy = (n.read_by ?? []).map((r: string) => r.toLowerCase())
        const id = n.id || `${n.from}-${n.timestamp}`
        const addressedToAgent = to === agentName || to === agentId || to === 'all'
        const agentHasNotRead = !readBy.includes(agentName) && !readBy.includes(agentId)
        // Skip self-sent notifications (mirrors dispatcher "sender is self" logic)
        const sentBySelf = from === agentName || from === agentId
        return addressedToAgent &&
               (ntype === 'completion' || ntype === 'status_update') &&
               agentHasNotRead &&
               !sentBySelf &&
               !autoSendSeenIds.current.has(id)
      })
      if (unreadCompletions.length === 0) return

      // Mark as seen so we don't re-trigger on subsequent WS pushes
      unreadCompletions.forEach(n => {
        autoSendSeenIds.current.add(n.id || `${n.from}-${n.timestamp}`)
      })

      // Debounce: wait 15s for more completions before auto-sending
      if (autoSendTimer.current) clearTimeout(autoSendTimer.current)
      autoSendTimer.current = setTimeout(() => {
        // Find the active agent's OW iframe
        const iframe = document.querySelector(
          `iframe[title="Chat — ${activeAgent.name}"]`
        ) as HTMLIFrameElement | null
        if (!iframe?.contentDocument) { console.warn('[auto-send] iframe not accessible'); return }

        try {
          const doc = iframe.contentDocument
          // OW uses TipTap/ProseMirror — robust selector fallback chain
          const inputSelectors = [
            'div#chat-input',
            'div.tiptap.ProseMirror',
            'div[contenteditable="true"]',
            'textarea#chat-textarea',
            'textarea[placeholder*="message"]',
          ]
          const chatInput = inputSelectors
            .map(s => doc.querySelector(s))
            .find(Boolean) as HTMLElement | null
          if (!chatInput) { console.warn('[auto-send] chat input not found'); return }

          // XSS-safe DOM construction (no innerHTML)
          if (chatInput.tagName === 'TEXTAREA') {
            (chatInput as HTMLTextAreaElement).value = 'Team notification has updates'
          } else {
            chatInput.innerHTML = ''
            const p = doc.createElement('p')
            p.textContent = 'Team notification has updates'
            chatInput.appendChild(p)
          }
          chatInput.dispatchEvent(new Event('input', { bubbles: true }))

          // Click the send button after a short delay (let OW process the input)
          setTimeout(() => {
            const sendBtn = doc.querySelector(
              'button#send-message-button, button[type="submit"]'
            ) as HTMLButtonElement | null
            if (sendBtn) {
              sendBtn.click()
              // Helper to mark completions as read (only called after confirmed success).
              // Skip for the master agent — the dispatcher owns master's read lifecycle.
              // Marking master's completions read here would prevent the dispatcher from
              // triggering master if the OW injection fails silently.
              const isMaster = activeAgent.id?.startsWith('master-')
              const markRead = () => {
                if (team && !isMaster) {
                  fetch(`/api/teams/${team.id}/notifications/mark-completions-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agent_name: activeAgent.name ?? 'master' }),
                  }).catch(() => {})
                }
              }
              // Recovery check: detect if send failed, retry once, then mark read.
              // Only marks as read after success — keeps notifications unread on
              // failure so the dispatcher or next auto-send cycle can retry.
              setTimeout(() => {
                try {
                  const stopBtn = doc.querySelector(
                    'button#stop-response-button, button[aria-label="Stop"]'
                  ) as HTMLButtonElement | null
                  const hasError = doc.querySelector('.error-message, [class*="error"]')
                  const el = chatInput.tagName === 'TEXTAREA' ? chatInput as HTMLTextAreaElement : chatInput
                  const stillHasText = el.tagName === 'TEXTAREA'
                    ? (el as HTMLTextAreaElement).value.includes('notification')
                    : (el.textContent ?? '').includes('notification')

                  if (!stopBtn && !hasError && !stillHasText) {
                    // Send succeeded — mark as read
                    markRead()
                    return
                  }

                  // Send failed — abort stuck stream
                  if (stopBtn) {
                    stopBtn.click()
                    console.warn('[auto-send] clicked stop to abort stuck stream')
                  }

                  // Retry: re-type and re-send after OW resets
                  setTimeout(() => {
                    try {
                      if (el.tagName === 'TEXTAREA') {
                        (el as HTMLTextAreaElement).value = 'Team notification has updates'
                      } else {
                        el.innerHTML = ''
                        const p = doc.createElement('p')
                        p.textContent = 'Team notification has updates'
                        el.appendChild(p)
                      }
                      el.dispatchEvent(new Event('input', { bubbles: true }))

                      setTimeout(() => {
                        const retryBtn = doc.querySelector(
                          'button#send-message-button, button[type="submit"]'
                        ) as HTMLButtonElement | null
                        if (retryBtn) {
                          retryBtn.click()
                          console.warn('[auto-send] retried after failed send')
                          // Mark read after retry (best-effort — if retry also
                          // fails, dispatcher handles it next cycle)
                          setTimeout(() => markRead(), 10_000)
                        }
                      }, 300)
                    } catch { /* iframe may be gone */ }
                  }, 2000)
                } catch { /* iframe may be gone */ }
              }, 10_000) // check 10s after initial send
            } else {
              console.warn('[auto-send] send button not found')
            }
          }, 300)
        } catch (e) {
          console.warn('[auto-send] iframe access failed:', e)
        }
      }, 15_000) // 15s debounce
    })

    return () => {
      ws.disconnect()
      if (autoSendTimer.current) clearTimeout(autoSendTimer.current)
    }
  }, [team?.id, activeAgent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const accent = team ? teamAccent(team.id) : 'var(--border-default)'

  // Context tag text reflects actual role, not just Master/Agent
  const contextTag = activeAgent?.is_master
    ? (lang === 'zh' ? '👑 Master' : '👑 Master')
    : (activeAgent?.role ?? (lang === 'zh' ? 'Agent' : 'Agent'))

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!team) {
    return (
      <aside style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderTop: '3px solid var(--border-default)', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)' }}>
        <Bot size={32} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: 13 }}>
          {lang === 'zh' ? '选择团队后开始聊天' : 'Select a team to start chatting'}
        </div>
      </aside>
    )
  }

  return (
    <aside style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderTop: `3px solid ${accent}`, overflow: 'hidden', transition: 'border-top-color 0.25s ease' }}>

      {/* ── Chat header ───────────────────────────────────────────────────── */}
      <div style={{ padding: '0 14px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>

        {/* Team context banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0 6px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0, transition: 'background 0.25s ease' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {team.name}
          </span>
          {/* Context tag — shows active agent's role */}
          {activeAgent && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: activeAgent.is_master ? 'rgba(63,185,80,.12)' : 'rgba(88,166,255,.12)', color: activeAgent.is_master ? 'var(--success)' : 'var(--accent)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {contextTag}
            </span>
          )}
        </div>

        {/* Agent row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
          {/* Agent icon */}
          <div style={{ width: 32, height: 32, borderRadius: 6, background: activeAgent?.is_master ? 'linear-gradient(135deg,var(--success),#56d364)' : 'linear-gradient(135deg,var(--accent),#79c0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'background 0.2s' }}>
            {activeAgent?.is_master ? '👑' : '🤖'}
          </div>

          {/* Name + status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loadingAgents ? (
              <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-card)', width: '60%', marginBottom: 4 }} />
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeAgent?.name ?? (lang === 'zh' ? '加载中…' : 'Loading…')}
              </div>
            )}
            {activeAgent && !loadingAgents && (
              <div style={{ marginTop: 2 }}>
                <StatusBadge status={activeAgent.status} small />
              </div>
            )}
          </div>

          {/* Agent selector — shown when 2+ agents available */}
          {agents.length > 1 && (
            <div ref={selectorRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setSelectorOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', background: 'var(--bg-card)', border: `1px solid ${selectorOpen ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: 6, fontSize: 12, color: selectorOpen ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'border-color 0.15s, color 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!selectorOpen) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' } }}
                onMouseLeave={e => { if (!selectorOpen) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' } }}>
                {lang === 'zh' ? '切换' : 'Switch'}
                <ChevronDown size={10} style={{ transform: selectorOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
              </button>

              {/* Dropdown */}
              {selectorOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, zIndex: 20, minWidth: 200, maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                  {agents.map(agent => {
                    const isSelected = agent.id === activeAgent?.id
                    const dotColor = STATUS_DOT[agent.status] ?? STATUS_DOT.stopped
                    return (
                      <div key={agent.id}
                        onClick={() => { setSelectedAgentId(agent.id); setSelectorOpen(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 13, cursor: 'pointer', background: isSelected ? 'rgba(88,166,255,0.12)' : 'transparent', transition: 'background 0.15s', borderBottom: '1px solid var(--border-default)' }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        {/* Status dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        {/* Agent avatar */}
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: agent.is_master ? 'linear-gradient(135deg,var(--success),#56d364)' : 'linear-gradient(135deg,var(--accent),#79c0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                          {agent.is_master ? '👑' : '🤖'}
                        </div>
                        {/* Name + role */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {agent.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {agent.role}
                          </div>
                        </div>
                        {/* Selected checkmark */}
                        {isSelected && (
                          <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Notification Bar — sub-agent notifications (outside iframe) ──── */}
      <NotificationBar teamId={team.id} />

      {/* ── Chat body — Open WebUI iframe ───────────────────────────────── */}
      {!activeAgent ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          {loadingAgents
            ? (lang === 'zh' ? '加载中…' : 'Loading…')
            : (lang === 'zh' ? '暂无 Agent' : 'No agents')}
        </div>
      ) : owError ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
          <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{owError}</span>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => {
            setOwError(null)
            api.getOpenWebUISession().then(({ token, webui_url }) => { setOwToken(token); setOwBaseUrl(process.env.NEXT_PUBLIC_OW_URL || webui_url) }).catch(() => setOwError(lang === 'zh' ? '无法连接 Open WebUI' : 'Open WebUI unavailable'))
          }}>
            {lang === 'zh' ? '重试' : 'Retry'}
          </button>
        </div>
      ) : !owToken || !owBaseUrl ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          {lang === 'zh' ? '连接中…' : 'Connecting…'}
        </div>
      ) : (
        // One iframe per agent — only rendered once its chat_id is resolved from the backend.
        // Waiting prevents the iframe from loading a new chat URL before the stored chat_id arrives.
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {agents.map(agent => {
            const isActive = agent.id === activeAgent.id
            const resolved = agent.id in chatIds
            if (!resolved) {
              // Not yet fetched — show loading only for active agent
              return isActive ? (
                <div key={agent.id} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {lang === 'zh' ? '连接中…' : 'Connecting…'}
                </div>
              ) : null
            }
            const chatId = chatIds[agent.id]
            const modelParam = encodeURIComponent(`${team.id}/${agent.id}`)
            const themeParam = `__theme=${theme}`
            // Pass allowed model IDs so the injected JS can filter OW's model list
            const allowedModels = agents.map(a => `${team.id}/${a.id}`).join(',')
            const allowedParam = `allowed_models=${encodeURIComponent(allowedModels)}`
            // P1-14: Load OW via nginx /ow/ prefix. Token is passed as query param;
            // nginx-injected script sets localStorage.token before OW JS runs.
            // If a stored chat_id exists, navigate directly to it; otherwise home with model pre-selected.
            const src = chatId
              ? `${owBaseUrl}/c/${chatId}?token=${owToken}&${themeParam}&${allowedParam}`
              : `${owBaseUrl}/?token=${owToken}&models=${modelParam}&${themeParam}&${allowedParam}`
            return (
              <iframe
                key={`${team.id}/${agent.id}`}
                src={src}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: isActive ? 'block' : 'none' }}
                allow="clipboard-write"
                title={`Chat — ${agent.name}`}
              />
            )
          })}
        </div>
      )}
    </aside>
  )
}
