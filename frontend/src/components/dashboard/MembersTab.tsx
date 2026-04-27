'use client'
/**
 * MembersTab — M3-C1: team members list for the dashboard MainPanel.
 *
 * Displays two sections per the v0.5.0 design spec:
 *
 *   👤 Owner / real users section
 *      - Team owner (from team.owner_id + user lookup, shown as the only entry)
 *
 *   🤖 AI Agents section (from api.getAgents)
 *      Each agent card shows:
 *        - Avatar (initial, gradient by name hash)
 *        - Robot badge overlay (🤖)
 *        - Name + role
 *        - Agent role badge (blue)
 *        - Paired real-user row below (⇄ icon, user id, "已配对")
 *        - Or "未配对" + "配对用户" button if paired_user_id is missing
 *
 * Acceptance criteria:
 *   ✅ Shows all team agents
 *   ✅ Each agent: avatar, name, role, status
 *   ✅ Shows paired real user (if any)
 *   ✅ Clicking agent card fires onAgentClick (for future drawer, #170)
 */
import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Agent } from '@/types'

interface Expert {
  id: string
  name: string
  role: string
  description?: string
  category?: string
  tags?: string[]
}

interface Props {
  teamId: string
  /** Called when user clicks an agent card — for future Agent Drawer (M3-C2) */
  onAgentClick?: (agent: Agent) => void
  /** Increment to programmatically open the expert modal (e.g. from LeftNav). */
  expertTrigger?: number
}

/** Deterministic avatar gradient by agent name */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#bc8cff,#9f73e2)',
  'linear-gradient(135deg,#58a6ff,#388bfd)',
  'linear-gradient(135deg,#3fb950,#2ea043)',
  'linear-gradient(135deg,#d29922,#b08800)',
  'linear-gradient(135deg,#f85149,#da3633)',
  'linear-gradient(135deg,#58a6ff,#79c0ff)',
]
function agentGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

export default function MembersTab({ teamId, onAgentClick, expertTrigger }: Props) {
  const { lang } = useLang()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpertModal, setShowExpertModal] = useState(false)
  const [experts, setExperts] = useState<Expert[]>([])
  const [loadingExperts, setLoadingExperts] = useState(false)
  const [expertError, setExpertError] = useState(false)
  const [expertSearch, setExpertSearch] = useState('')
  const [addingExpert, setAddingExpert] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // heartbeat toggle state: agentId → 'on' | 'off' | undefined (loading)
  const [heartbeats, setHeartbeats] = useState<Record<string, 'on' | 'off'>>({})
  const [togglingHb, setTogglingHb] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const openExpertModal = async () => {
    setShowExpertModal(true)
    setExpertSearch('')
    setExpertError(false)
    setLoadingExperts(true)
    try {
      const data = await api.listExperts()
      setExperts(Array.isArray(data) ? data : [])
    } catch {
      setExperts([])
      setExpertError(true)
    } finally {
      setLoadingExperts(false)
    }
  }

  const handleAddExpert = async (expertId: string) => {
    setAddingExpert(expertId)
    try {
      await api.addExpertToTeam(teamId, expertId)
      setShowExpertModal(false)
      showToast(lang === 'zh' ? '✅ 专家已加入团队' : '✅ Expert added to team')
      await loadAgents()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : (lang === 'zh' ? '添加失败' : 'Failed to add expert'))
    } finally {
      setAddingExpert(null)
    }
  }

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAgents(teamId)
      const sorted = data.sort((a, b) => (a.is_master ? -1 : 1) - (b.is_master ? -1 : 1) || a.name.localeCompare(b.name))
      setAgents(sorted)
      // Fetch heartbeat status for all agents in parallel
      const hbResults = await Promise.allSettled(
        sorted.map(a => api.getAgentHeartbeat(teamId, a.id))
      )
      const hbMap: Record<string, 'on' | 'off'> = {}
      hbResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          hbMap[sorted[i].id] = r.value.heartbeat as 'on' | 'off'
        } else {
          hbMap[sorted[i].id] = 'on' // default
        }
      })
      setHeartbeats(hbMap)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [teamId])

  const handleToggleHeartbeat = async (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation()
    const current = heartbeats[agent.id] ?? 'on'
    const next = current === 'on' ? 'off' : 'on'
    // Warn when disabling master agent heartbeat
    if (next === 'off' && agent.is_master) {
      if (!window.confirm(
        lang === 'zh'
          ? '关闭 Master Agent 心跳后，sub-agent 的完成通知将无人自动处理。确定关闭？'
          : 'Disabling Master Agent heartbeat means sub-agent notifications won\'t be auto-processed. Confirm?'
      )) return
    }
    setTogglingHb(agent.id)
    try {
      const res = await api.setAgentHeartbeat(teamId, agent.id, next)
      setHeartbeats(prev => ({ ...prev, [agent.id]: res.heartbeat as 'on' | 'off' }))
      showToast(next === 'on'
        ? (lang === 'zh' ? `✅ ${agent.name} 心跳已开启` : `✅ ${agent.name} heartbeat enabled`)
        : (lang === 'zh' ? `🔕 ${agent.name} 心跳已关闭` : `🔕 ${agent.name} heartbeat disabled`)
      )
    } catch {
      showToast(lang === 'zh' ? '操作失败，请重试' : 'Failed, please try again')
    } finally {
      setTogglingHb(null)
    }
  }

  useEffect(() => { loadAgents() }, [loadAgents])

  // Open expert modal when externally triggered (e.g. LeftNav Experts click)
  useEffect(() => {
    if (expertTrigger != null && expertTrigger > 0) {
      openExpertModal()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertTrigger])

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', padding: '12px 0 6px' }}>
      {text}
    </div>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 56, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  // Split master from sub-agents
  const master = agents.find(a => a.is_master)
  const subAgents = agents.filter(a => !a.is_master)

  const renderAgentCard = (agent: Agent) => {
    // paired_user_id lives on the agent object (set via PATCH /agents/{id}/pair)
    const pairedUserId = (agent as Agent & { paired_user_id?: string }).paired_user_id

    return (
      <div key={agent.id}
        onClick={() => onAgentClick?.(agent)}
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${onAgentClick ? 'var(--border-default)' : 'var(--border-default)'}`,
          borderLeft: '3px solid var(--accent)',
          borderRadius: 8,
          marginBottom: 8,
          overflow: 'hidden',
          cursor: onAgentClick ? 'pointer' : 'default',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          if (onAgentClick) {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(88,166,255,.12)'
          }
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.borderColor = ''
          ;(e.currentTarget as HTMLElement).style.boxShadow = ''
        }}>
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          {/* Avatar + badge */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: agentGradient(agent.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {agent.name[0]?.toUpperCase() ?? '?'}
            </div>
            {/* Robot badge */}
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, lineHeight: 1 }}>
              🤖
            </div>
          </div>
          {/* Name + role */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{agent.role}</div>
          </div>
          {/* Status + role badge + heartbeat toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: 'rgba(88,166,255,.12)', color: 'var(--accent)' }}>
              {lang === 'zh' ? 'Agent' : 'Agent'}
            </span>
            <StatusBadge status={agent.status} small />
            {/* Heartbeat toggle */}
            {agent.id in heartbeats && (
              <button
                onClick={e => handleToggleHeartbeat(e, agent)}
                disabled={togglingHb === agent.id}
                title={heartbeats[agent.id] === 'on'
                  ? (lang === 'zh' ? '心跳已开启，点击关闭' : 'Heartbeat on — click to disable')
                  : (lang === 'zh' ? '心跳已关闭，点击开启' : 'Heartbeat off — click to enable')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 10, padding: '2px 6px', borderRadius: 10,
                  fontFamily: 'inherit', cursor: togglingHb === agent.id ? 'default' : 'pointer',
                  border: '1px solid',
                  borderColor: heartbeats[agent.id] === 'on' ? 'rgba(63,185,80,.4)' : 'rgba(110,118,129,.4)',
                  background: heartbeats[agent.id] === 'on' ? 'rgba(63,185,80,.1)' : 'rgba(110,118,129,.08)',
                  color: heartbeats[agent.id] === 'on' ? 'var(--success)' : 'var(--text-muted)',
                  opacity: togglingHb === agent.id ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}>
                {heartbeats[agent.id] === 'on' ? '💓' : '💤'}
                {heartbeats[agent.id] === 'on'
                  ? (lang === 'zh' ? '心跳' : 'HB')
                  : (lang === 'zh' ? '静默' : 'off')}
              </button>
            )}
          </div>
        </div>

        {/* Pairing row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 10px 48px', borderTop: '1px dashed var(--border-default)', background: 'rgba(88,166,255,.04)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>⇄</span>
          {pairedUserId ? (
            <>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#3fb950,#2ea043)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {pairedUserId[0]?.toUpperCase() ?? '?'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pairedUserId}
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent)', background: 'rgba(88,166,255,.1)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                {lang === 'zh' ? '已配对' : 'Paired'}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', flex: 1 }}>
                {lang === 'zh' ? '暂未配对真实用户' : 'No paired user'}
              </span>
              <button
                onClick={e => { e.stopPropagation(); /* M3-C3 invite modal */ }}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'transparent', border: '1px dashed rgba(88,166,255,.4)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                + {lang === 'zh' ? '配对用户' : 'Link user'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Master agent section ── */}
      {master && (
        <>
          {sectionLabel(lang === 'zh' ? '👑 Master Agent' : '👑 Master Agent')}
          {renderAgentCard(master)}
        </>
      )}

      {/* ── Sub-agents section ── */}
      {subAgents.length > 0 && (
        <>
          {sectionLabel(lang === 'zh' ? '🤖 AI Agents' : '🤖 AI Agents')}
          {subAgents.map(renderAgentCard)}
        </>
      )}

      {agents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {lang === 'zh' ? '暂无 Agent' : 'No agents'}
        </div>
      )}

      {/* ── Invite expert section ── */}
      <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 16, paddingTop: 16 }}>
        <button onClick={openExpertModal}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'rgba(88,166,255,.08)', border: '1px dashed rgba(88,166,255,.4)', borderRadius: 8, fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,.08)' }}>
          <UserPlus size={14} />
          {lang === 'zh' ? '邀请新专家' : 'Add expert'}
        </button>
      </div>

      {/* ── Expert selection modal ── */}
      {showExpertModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }} onClick={() => setShowExpertModal(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, width: 480, maxWidth: '90vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', zIndex: 201, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {lang === 'zh' ? '选择专家加入团队' : 'Add expert to team'}
              </span>
              <button onClick={() => setShowExpertModal(false)} style={{ width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderRadius: 4 }}>
                <X size={14} />
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 10px' }}>
                <Search size={13} color="var(--text-muted)" />
                <input
                  type="text"
                  value={expertSearch}
                  onChange={e => setExpertSearch(e.target.value)}
                  placeholder={lang === 'zh' ? '搜索专家...' : 'Search experts...'}
                  autoFocus
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            {/* Expert list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {loadingExperts ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: 52, background: 'var(--bg-card)', borderRadius: 8 }} />)}
                </div>
              ) : expertError ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--danger)', fontSize: 13 }}>
                  {lang === 'zh' ? '加载专家失败，请重试' : 'Failed to load experts, please try again'}
                </div>
              ) : (() => {
                const q = expertSearch.toLowerCase()
                const filteredExperts = experts.filter(e =>
                  !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.category ?? '').toLowerCase().includes(q)
                )
                return filteredExperts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    {lang === 'zh' ? '无匹配专家' : 'No experts found'}
                  </div>
                ) : (
                  filteredExperts.map(expert => (
                    <div key={expert.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: addingExpert ? 'default' : 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { if (!addingExpert) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      onClick={() => !addingExpert && handleAddExpert(expert.id)}>
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: agentGradient(expert.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {expert.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{expert.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{expert.role}</div>
                      </div>
                      {/* Category badge */}
                      {expert.category && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(88,166,255,.1)', color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>
                          {expert.category}
                        </span>
                      )}
                      {/* Add button */}
                      {addingExpert === expert.id ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>…</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0, fontWeight: 500 }}>
                          {lang === 'zh' ? '+ 加入' : '+ Add'}
                        </span>
                      )}
                    </div>
                  ))
                )
              })()}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: toast.startsWith('✅') ? 'var(--success)' : 'var(--danger)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
