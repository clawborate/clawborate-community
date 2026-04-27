'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Bot } from 'lucide-react'
import type { Team } from '@/types'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Lang } from '@/lib/locales'
import { getT } from '@/lib/locales'
import { api } from '@/lib/api'

interface Props { team: Team; lang: Lang; onRename: (t: Team) => void; onDelete: (t: Team) => void; onRefresh: () => void; isAdmin?: boolean; unreadCount?: number }

export default function TeamCard({ team, lang, onRename, onDelete, onRefresh, isAdmin = false, unreadCount = 0 }: Props) {
  const t = getT(lang)
  const [hovered, setHovered] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  const confirmRename = async (agentId: string) => {
    if (!renameVal.trim()) return
    try { await api.renameAgent(team.id, agentId, renameVal.trim()); setRenamingId(null); onRefresh() }
    catch (e) { console.error(e) }
  }

  return (
    <div className="card" style={{ position: 'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Unread badge */}
      {unreadCount > 0 && (
        <div style={{ position: 'absolute', top: -6, right: -6, background: '#F85149', color: '#fff', fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', zIndex: 10, opacity: hovered ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
          {unreadCount}
        </div>
      )}
      {/* Top actions */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        {team.pending_decisions > 0 && (
          <span style={{ background: 'rgba(210,153,34,0.12)', color: '#D29922', fontSize: 12, padding: '3px 8px', borderRadius: 4, marginRight: 4 }}>
            {team.pending_decisions} {t.teams.needAction}
          </span>
        )}
        {isAdmin && <button className="btn-icon" onClick={() => onRename(team)}><Pencil size={14} /></button>}
        {isAdmin && <button className="btn-icon" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(team)}><Trash2 size={14} /></button>}
      </div>

      {/* Team name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 4 }}>
        <span style={{ fontSize: 20 }}>🏠</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{team.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{team.sub_agents.length} Agents · Master: {team.master?.status || 'stopped'}</div>
        </div>
      </div>

      {/* Master block */}
      {team.master && (
        <div style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.teams.master}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-code)' }}>{team.master.container_id || team.master.id}</div>
          </div>
          <StatusBadge status={team.master.status} small />
        </div>
      )}

      {/* Sub agents */}
      {team.sub_agents.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.teams.subAgents} ({team.sub_agents.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {team.sub_agents.map(agent => (
              <div key={agent.id} style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px 12px' }}>
                {renamingId === agent.id ? (
                  <div>
                    <input className="input" style={{ fontSize: 12, padding: '2px 6px', marginBottom: 4 }} value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmRename(agent.id); if (e.key === 'Escape') setRenamingId(null) }}
                      autoFocus />
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn-icon" style={{ color: 'var(--color-success)', width: 20, height: 20 }} onClick={() => confirmRename(agent.id)}>✓</button>
                      <button className="btn-icon" style={{ width: 20, height: 20 }} onClick={() => setRenamingId(null)}>✗</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Bot size={12} color="var(--text-secondary)" />
                      <span style={{ fontSize: 12, flex: 1 }}>{agent.name}</span>
                      {hovered && (
                        <button className="btn-icon" style={{ width: 16, height: 16 }} onClick={() => { setRenamingId(agent.id); setRenameVal(agent.name) }}>
                          <Pencil size={10} />
                        </button>
                      )}
                    </div>
                    <StatusBadge status={agent.status} small />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', margin: '12px 0 10px' }} />

      {/* Bottom actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Link href={`/?teamId=${team.id}`}>
          <button className="btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>{t.teams.openTeam}</button>
        </Link>
      </div>
    </div>
  )
}
