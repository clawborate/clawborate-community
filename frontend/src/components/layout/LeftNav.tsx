'use client'
/**
 * LeftNav — 200px left sidebar (M3-A1 polished version).
 *
 * New in A1 vs A0:
 *   - Team search: filter input above the team list
 *   - Experts entry: links to the experts hub (calls onExperts prop)
 *   - User menu: clicking the user row opens a popup with:
 *       Theme toggle (Dark / Light)
 *       Language toggle (中文 / EN)
 *       Settings (calls onSettings prop)
 *       Logout (calls onLogout prop)
 *   - Responsive: collapse/expand already in A0, unchanged
 *
 * Collapses to a 52px icon rail on screens ≤ 767px.
 * Unread counts stay in sync via GlobalUnreadWS.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Brain, ChevronUp, Search, Sun, Moon, Settings, LogOut, Languages } from 'lucide-react'
import { api } from '@/lib/api'
import { GlobalUnreadWS } from '@/lib/ws'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useLang } from '@/hooks/useLang'
import { teamGradient } from '@/lib/teamColor'
import type { Team } from '@/types'

interface Props {
  activeTeamId: string | null
  /** Team list owned by the parent (keeps in sync on create/delete). */
  teams: Team[]
  onSelectTeam: (id: string) => void
  onNewTeam: () => void
  /** Called when the user clicks the Experts entry */
  onExperts: () => void
  /** Called when the user chooses Settings from the user menu */
  onSettings?: () => void
  /** Called when the user chooses Logout */
  onLogout?: () => void
}

export default function LeftNav({
  activeTeamId, teams, onSelectTeam, onNewTeam, onExperts, onSettings, onLogout,
}: Props) {
  const { user, isTeamAdmin } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, toggle: toggleLang } = useLang()

  const [unread, setUnread] = useState<Record<string, number>>({})
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Responsive collapse on narrow viewports
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setCollapsed(mq.matches)
    const h = (e: MediaQueryListEvent) => setCollapsed(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Single global WS for unread badges
  useEffect(() => {
    const ws = new GlobalUnreadWS()
    ws.connect(counts => setUnread(counts))
    return () => ws.disconnect()
  }, [])

  const userInitial = user?.name?.[0]?.toUpperCase() ?? '?'
  const roleLabel =
    user?.role === 'platform_admin' ? (lang === 'zh' ? '管理员' : 'Admin') :
    user?.role === 'team_admin'     ? (lang === 'zh' ? '团队管理员' : 'Team Admin') :
                                      (lang === 'zh' ? '成员' : 'Member')

  // Filtered team list
  const filteredTeams = search.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams

  // ── Icon rail (collapsed) ──────────────────────────────────────────────────
  if (collapsed) {
    return (
      <nav style={{ width: 52, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 6px', gap: 8, overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg,var(--accent),#79c0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 4, flexShrink: 0 }}>🐾</div>
        {/* New team */}
        {isTeamAdmin && (
          <button onClick={onNewTeam} title={lang === 'zh' ? '新建团队' : 'New Team'} style={{ width: 32, height: 32, background: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plus size={14} color="#fff" />
          </button>
        )}
        {/* Experts */}
        <button onClick={onExperts} title={lang === 'zh' ? '专家' : 'Experts'} style={{ width: 32, height: 32, background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Brain size={14} color="var(--text-secondary)" />
        </button>
        {/* Team avatars */}
        {teams.map(team => {
          const badge = unread[team.id] ?? 0
          const isActive = team.id === activeTeamId
          return (
            <button key={team.id} onClick={() => onSelectTeam(team.id)} title={team.name}
              style={{ position: 'relative', width: 32, height: 32, borderRadius: 6, background: isActive ? teamGradient(team.id) : 'var(--bg-card)', border: isActive ? 'none' : '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {team.name[0]?.toUpperCase() ?? '?'}
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '1px 4px', minWidth: 14, textAlign: 'center', lineHeight: '14px' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
        {/* Expand */}
        <button onClick={() => setCollapsed(false)} title={lang === 'zh' ? '展开' : 'Expand'} style={{ marginTop: 'auto', width: 32, height: 32, background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}>›</button>
      </nav>
    )
  }

  // ── Full nav ───────────────────────────────────────────────────────────────
  return (
    <nav style={{ width: 200, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 4, overflowY: 'auto' }}>

      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 12px', borderBottom: '1px solid var(--border-default)', marginBottom: 4 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,var(--accent),#79c0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🐾</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>clawborate</span>
        {/* Version badge */}
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.4px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '1px 5px', alignSelf: 'flex-end', marginBottom: 1, flexShrink: 0 }}>{process.env.NEXT_PUBLIC_VERSION || 'dev'}</span>
        {/* Collapse */}
        <button onClick={() => setCollapsed(true)} title={lang === 'zh' ? '折叠' : 'Collapse'} style={{ marginLeft: 'auto', width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}>‹</button>
      </div>

      {/* ── New Team button — only visible to team_admin and platform_admin ── */}
      {isTeamAdmin && (
        <button onClick={onNewTeam}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', width: '100%', marginBottom: 4, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}>
          <Plus size={13} />
          {lang === 'zh' ? '新建团队' : 'New Team'}
        </button>
      )}

      {/* ── Experts nav item ── */}
      <div onClick={onExperts}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg-card)'; el.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = 'var(--text-secondary)' }}>
        <Brain size={15} style={{ flexShrink: 0 }} />
        <span>{lang === 'zh' ? '专家' : 'Experts'}</span>
      </div>

      {/* ── Teams section label ── */}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', padding: '8px 10px 4px' }}>
        {lang === 'zh' ? '我的团队' : 'My Teams'}
      </div>

      {/* ── Team search input ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 2px 4px', padding: '5px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, transition: 'border-color 0.15s' }}
        onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
        onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)' }}>
        <Search size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'zh' ? '搜索团队…' : 'Search teams…'}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit', minWidth: 0 }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
        )}
      </div>

      {/* ── Team list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredTeams.length === 0 && search && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            {lang === 'zh' ? '无结果' : 'No results'}
          </div>
        )}
        {filteredTeams.map(team => {
          const isActive = team.id === activeTeamId
          const badge = unread[team.id] ?? 0
          return (
            <div key={team.id} onClick={() => onSelectTeam(team.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: isActive ? 'rgba(88,166,255,0.12)' : 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: teamGradient(team.id) }}>
                {team.name[0]?.toUpperCase() ?? '?'}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {team.name}
              </span>
              {badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {badge}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── User footer with popup menu ── */}
      <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 8, marginTop: 'auto', position: 'relative' }} ref={userMenuRef}>
        {/* User menu popup — appears above the footer */}
        {userMenuOpen && (
          <div style={{ position: 'absolute', bottom: '100%', left: 4, right: 4, marginBottom: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 20 }}>
            {/* Theme toggle */}
            <button onClick={() => { toggleTheme(); setUserMenuOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark'
                ? (lang === 'zh' ? '切换浅色' : 'Light mode')
                : (lang === 'zh' ? '切换深色' : 'Dark mode')}
            </button>
            {/* Language toggle */}
            <button onClick={() => { toggleLang(); setUserMenuOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
              <Languages size={14} />
              {lang === 'zh' ? 'Switch to English' : '切换中文'}
            </button>
            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-default)', margin: '2px 0' }} />
            {/* Settings */}
            {onSettings && (
              <button onClick={() => { onSettings(); setUserMenuOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                <Settings size={14} />
                {lang === 'zh' ? '设置' : 'Settings'}
              </button>
            )}
            {/* Logout */}
            {onLogout && (
              <button onClick={() => { onLogout(); setUserMenuOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--danger)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,81,73,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                <LogOut size={14} />
                {lang === 'zh' ? '退出登录' : 'Log out'}
              </button>
            )}
          </div>
        )}

        {/* User row — click to toggle menu */}
        <div onClick={() => setUserMenuOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', background: userMenuOpen ? 'var(--bg-card)' : 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
          onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = '' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,var(--success),#56d364)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? (lang === 'zh' ? '用户' : 'User')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{roleLabel}</div>
          </div>
          {/* Chevron rotates when menu is open */}
          <ChevronUp size={11} color="var(--text-muted)" style={{ flexShrink: 0, transform: userMenuOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
        </div>
      </div>
    </nav>
  )
}
