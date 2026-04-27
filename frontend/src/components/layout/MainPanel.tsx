'use client'
/**
 * MainPanel — flex-1 center column of the M3 dashboard layout.
 *
 * When a team is selected, shows:
 *   - Team header (avatar, name, member count, active status)
 *   - 4-tab bar: 项目状态 / 成员管理 / 团队配置 / 文件管理
 *   - Tab content area with placeholder content (detailed panels filled in later M3 issues)
 *
 * When no team is selected, shows an empty / welcome state.
 */
import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLang } from '@/hooks/useLang'
import { useAuth } from '@/hooks/useAuth'
import { getT } from '@/lib/locales'
import { teamGradient } from '@/lib/teamColor'
import { api } from '@/lib/api'
import StatusTab from '@/components/dashboard/StatusTab'
import MembersTab from '@/components/dashboard/MembersTab'
import LLMConfigTab from '@/components/dashboard/LLMConfigTab'
import ChannelsTab from '@/components/dashboard/ChannelsTab'
import FilesTab from '@/components/dashboard/FilesTab'
import AgentDrawer from '@/components/teams/AgentDrawer'
import type { Team, Agent } from '@/types'

type TabId = 'status' | 'members' | 'config' | 'files'

const TABS: { id: TabId; zh: string; en: string }[] = [
  { id: 'status',   zh: '项目状态', en: 'Status'   },
  { id: 'members',  zh: '成员管理', en: 'Members'  },
  { id: 'config',   zh: '团队配置', en: 'Config'   },
  { id: 'files',    zh: '文件管理', en: 'Files'    },
]

interface Props {
  team: Team | null
  onTeamDeleted?: (teamId: string) => void
  /** Increment to switch to Members tab and open expert modal. */
  expertTrigger?: number
}

function PlaceholderSection({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</div>
      {rows.map((w, i) => (
        <div key={i} style={{ height: 36, background: 'var(--bg-card)', borderRadius: 6, marginBottom: i < rows.length - 1 ? 8 : 0, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-default)', flexShrink: 0 }} />
          <div style={{ height: 10, borderRadius: 5, background: 'var(--border-default)', width: w }} />
        </div>
      ))}
    </div>
  )
}

export default function MainPanel({ team, onTeamDeleted, expertTrigger }: Props) {
  const { lang } = useLang()
  const { isTeamAdmin } = useAuth()
  const t = getT(lang)
  const [activeTab, setActiveTab] = useState<TabId>('status')

  // Switch to members tab when externally triggered (e.g. LeftNav Experts click)
  useEffect(() => {
    if (expertTrigger) setActiveTab('members')
  }, [expertTrigger])
  const [drawerAgent, setDrawerAgent] = useState<Agent | null>(null)

  // Delete team modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const nameMatch = !!team && deleteInput === team.name

  const handleDeleteTeam = async () => {
    if (!team || !nameMatch) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.deleteTeam(team.id)
      setShowDeleteModal(false)
      onTeamDeleted?.(team.id)
    } catch {
      setDeleteError(lang === 'zh' ? '删除失败，请重试。' : 'Delete failed. Please try again.')
      setDeleting(false)
    }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!team) {
    return (
      <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
            {lang === 'zh' ? '从左侧选择一个团队' : 'Select a team from the left'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {lang === 'zh' ? '或创建新团队开始' : 'or create a new team to get started'}
          </div>
        </div>
      </main>
    )
  }

  const memberCount = (team.sub_agents?.length ?? 0) + 1  // +1 for master

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Team header */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 14px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: teamGradient(team.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {team.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              <span>{memberCount} {lang === 'zh' ? '成员' : 'members'}</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ color: 'var(--success)' }}>● {lang === 'zh' ? '活跃' : 'Active'}</span>
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 20px', overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isActive = tab.id === activeTab
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '9px 16px', fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s', marginBottom: -1, fontFamily: 'inherit' }}>
                {lang === 'zh' ? tab.zh : tab.en}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeTab === 'status'   ? <StatusTab teamId={team.id} /> :
         activeTab === 'members'  ? <MembersTab teamId={team.id} onAgentClick={agent => setDrawerAgent(agent)} expertTrigger={expertTrigger} /> :
         activeTab === 'files'    ? <FilesTab teamId={team.id} /> :
         activeTab === 'config'   ? (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
             <div>
               <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>
                 {lang === 'zh' ? 'LLM 配置' : 'LLM Configuration'}
               </div>
               <LLMConfigTab teamId={team.id} />
             </div>
             <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 24 }}>
               <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>
                 {lang === 'zh' ? '聊天渠道' : 'Chat Channels'}
               </div>
               <ChannelsTab teamId={team.id} />
             </div>
             {isTeamAdmin && (
               <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 24 }}>
                 <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>
                   {t.teamDetail.dangerZone}
                 </div>
                 <div style={{ border: '1px solid rgba(248,81,73,.35)', background: 'rgba(248,81,73,.05)', borderRadius: 8, padding: '16px 18px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                     <AlertTriangle size={15} color="#F85149" />
                     <span style={{ fontSize: 14, fontWeight: 600, color: '#F85149' }}>
                       {t.teamDetail.dangerZone}
                     </span>
                   </div>
                   <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                     {t.teamDetail.dangerDesc}
                   </p>
                   <button
                     onClick={() => { setDeleteInput(''); setDeleteError(''); setShowDeleteModal(true) }}
                     style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#F85149', border: '1px solid #F85149', transition: 'background 0.15s, color 0.15s' }}
                     onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#F85149'; b.style.color = '#fff' }}
                     onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = '#F85149' }}
                   >
                     {lang === 'zh' ? '删除团队' : 'Delete Team'}
                   </button>
                 </div>
               </div>
             )}
           </div>
         ) :
         null}
      </div>

      {/* Agent Drawer — slides in from the right when an agent card is clicked in MembersTab */}
      {drawerAgent && team && (
        <AgentDrawer
          agent={drawerAgent}
          teamId={team.id}
          onClose={() => setDrawerAgent(null)}
        />
      )}

      {/* Delete Team Confirm Modal */}
      {showDeleteModal && team && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => { if (!deleting) setShowDeleteModal(false) }}
        >
          <div
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 28, width: 'min(480px, 94vw)', animation: 'deleteModalIn 0.2s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              {lang === 'zh' ? '⚠️ 删除团队' : '⚠️ Delete Team'}
            </h2>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', marginBottom: 16 }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              {lang === 'zh'
                ? '此操作不可恢复。请在下方精确输入团队名称以确认：'
                : 'This action cannot be undone. Type the exact team name below to confirm:'}
            </p>
            {team.pending_decisions > 0 && (
              <p style={{ fontSize: 12, color: '#D29922', marginBottom: 12 }}>
                ⚠ {lang === 'zh' ? `${team.pending_decisions} 个进行中的任务将被终止。` : `${team.pending_decisions} active task${team.pending_decisions > 1 ? 's' : ''} will be terminated.`}
              </p>
            )}
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={team.name}
              disabled={deleting}
              autoFocus
              style={{ width: '100%', fontSize: 13, padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: `1px solid ${nameMatch ? '#3FB950' : 'var(--border-default)'}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box', marginBottom: 20, transition: 'border-color 0.2s' }}
              onKeyDown={e => { if (e.key === 'Enter' && nameMatch && !deleting) handleDeleteTeam() }}
            />
            {deleteError && <p style={{ fontSize: 12, color: '#F85149', marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" disabled={deleting} onClick={() => setShowDeleteModal(false)}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                disabled={!nameMatch || deleting}
                onClick={handleDeleteTeam}
                style={{ fontSize: 13, padding: '6px 16px', borderRadius: 6, cursor: nameMatch && !deleting ? 'pointer' : 'not-allowed', background: nameMatch && !deleting ? '#F85149' : 'var(--bg-card)', color: nameMatch && !deleting ? '#fff' : 'var(--text-muted)', border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
              >
                {deleting && <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block', flexShrink: 0 }} />}
                {deleting ? (lang === 'zh' ? '删除中…' : 'Deleting…') : (lang === 'zh' ? '确认删除' : 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
