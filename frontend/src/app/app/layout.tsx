'use client'
/**
 * Dashboard Layout (M3-A0) — three-column shell.
 *
 * ┌──────────┬───────────────────────┬──────────┐
 * │ LeftNav  │     MainPanel         │ RightChat│
 * │ 200px    │     flex-1            │ 340px    │
 * └──────────┴───────────────────────┴──────────┘
 *
 * Responsibilities:
 *   - Owns `activeTeamId` state (drives both center and right panels)
 *   - Loads team list; auto-selects first team on first load
 *   - Hosts the New Team modal (two-step: choose template → name team)
 *   - Forwards `onNewTeam` / `onExperts` callbacks to LeftNav
 *
 * The layout renders as `height: 100vh; overflow: hidden` so each column
 * can independently scroll its own content.
 */
import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { Info } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import LeftNav from '@/components/layout/LeftNav'
import SettingsModal from '@/components/layout/SettingsModal'
import MainPanel from '@/components/layout/MainPanel'
import RightChatPanel from '@/components/layout/RightChatPanel'
import Modal from '@/components/ui/Modal'
import { api, type Template } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import { getT } from '@/lib/locales'
import { useAuth } from '@/hooks/useAuth'
import type { Team } from '@/types'

// Wrapper component to handle useSearchParams with Suspense
function DashboardLayoutInner({ children: _children }: { children: React.ReactNode }) {
  const { lang } = useLang()
  const t = getT(lang)
  const { isTeamAdmin } = useAuth()
  const searchParams = useSearchParams()
  const urlTeamId = searchParams.get('teamId')

  const [teams, setTeams] = useState<Team[]>([])
  const [activeTeamId, setActiveTeamId] = useState<string | null>(urlTeamId)

  // Right-panel width — draggable divider, persisted to localStorage.
  // Fixed initial value avoids SSR/hydration mismatch; localStorage is read after mount.
  const [rightWidth, setRightWidth] = useState(462)
  const rightWidthRef = useRef(rightWidth)
  rightWidthRef.current = rightWidth
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const onDividerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    dragStartX.current = e.clientX
    // Read actual rendered width from DOM to avoid React state sync lag
    dragStartWidth.current = rightPanelRef.current
      ? rightPanelRef.current.getBoundingClientRect().width
      : rightWidthRef.current
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  }, [])

  const onDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    const delta = dragStartX.current - e.clientX
    const newWidth = Math.max(280, Math.min(700, dragStartWidth.current + delta))
    setRightWidth(newWidth)
  }, [])

  const onDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  // Restore document.body styles if component unmounts mid-drag
  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  // Restore persisted width after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('rightChatWidth')
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed)) setRightWidth(parsed)
    }
  }, [])

  // Persist right panel width on every drag change
  useEffect(() => {
    if (!isDragging.current) return
    localStorage.setItem('rightChatWidth', String(rightWidth))
  }, [rightWidth])

  // New-team modal state
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expertTrigger, setExpertTrigger] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formName, setFormName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadTeams = useCallback(async () => {
    try {
      const data = await api.getTeams()
      setTeams(data)
      // Auto-select URL teamId, or first team only on initial load (when nothing selected yet)
      setActiveTeamId(prev => prev ?? urlTeamId ?? (data[0]?.id ?? null))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  // Update active team when URL teamId changes
  useEffect(() => {
    if (urlTeamId) {
      setActiveTeamId(urlTeamId)
    }
  }, [urlTeamId])

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {})
  }, [])

  const activeTeam = teams.find(t => t.id === activeTeamId) ?? null

  // ── New-team modal helpers ─────────────────────────────────────────────────
  const openNewTeam = () => {
    setShowNewTeam(true)
    setStep(1)
    setSelectedTemplate(null)
    setFormName('')
    setError('')
  }

  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl)
    setStep(2)
    const name = (lang === 'zh' ? tpl.default_team_name_zh : tpl.default_team_name) ?? tpl.default_team_name ?? ''
    setFormName(name)
    setError('')
  }

  const handleCreate = async () => {
    if (!formName.trim() || !selectedTemplate) return
    setSubmitting(true); setError('')
    try {
      await api.createTeam(formName.trim(), selectedTemplate.id)
      setShowNewTeam(false)
      setFormName('')
      await loadTeams()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const tplIcons: Record<string, string> = { lean: '🤖', standard: '🚀' }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <LeftNav
        activeTeamId={activeTeamId}
        teams={teams}
        onSelectTeam={setActiveTeamId}
        onNewTeam={openNewTeam}
        onExperts={() => setExpertTrigger(v => v + 1)}
        onSettings={() => setShowSettings(true)}
        onLogout={async () => {
          try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
          window.location.href = '/'
        }}
      />
      <MainPanel
        team={activeTeam}
        expertTrigger={expertTrigger}
        onTeamDeleted={async deletedId => {
          setTeams(prev => prev.filter(t => t.id !== deletedId))
          setActiveTeamId(null)
          await loadTeams() // Reload from server to ensure sync
        }}
      />
      {/* Draggable divider — uses pointer capture so iframe can't steal events */}
      <div
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'var(--border-default)', transition: 'background 0.15s', zIndex: 10, touchAction: 'none' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-default)' }}
      />
      <div ref={rightPanelRef} style={{ width: rightWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', alignSelf: 'stretch' }}>
        <RightChatPanel team={activeTeam} width={rightWidth} />
      </div>

      {/* ── New Team Modal (two-step) ────────────────────────────────────── */}
      <Modal open={showNewTeam && isTeamAdmin} onClose={() => setShowNewTeam(false)} title={t.teams.createModal.title}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: step === 1 ? 'var(--accent)' : 'rgba(63,185,80,0.2)', color: step === 1 ? '#fff' : '#3FB950' }}>
            {step === 1 ? '1' : '✓'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.teams.createModal.stepChooseTemplate}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
          <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: step === 2 ? 'var(--accent)' : 'var(--bg-surface)', border: step === 2 ? 'none' : '1.5px solid var(--border-default)', color: step === 2 ? '#fff' : 'var(--text-disabled)' }}>
            2
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.teams.createModal.stepNameTeam}</span>
        </div>

        {/* Step 1: template cards */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>{t.teams.createModal.templateSubtitle}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
              {templates.map(tpl => (
                <div key={tpl.id} onClick={() => handleSelectTemplate(tpl)}
                  style={{ background: 'var(--bg-base)', border: '2px solid var(--border-default)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{tplIcons[tpl.id] ?? '🤖'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{tpl.display_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, marginBottom: 4 }}>{tpl.description}</div>
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '10px 0 8px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {tpl.agents.map(agent => (
                      <div key={agent.id_suffix} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, lineHeight: 1.4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: agent.is_master ? '#3FB950' : '#58A6FF' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: 60 }}>{agent.name}</span>
                        <span style={{ color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-default)', paddingLeft: 4, minWidth: 90 }}>{agent.role}</span>
                        <span style={{ color: 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{agent.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowNewTeam(false)}>{t.teams.createModal.cancel}</button>
            </div>
          </div>
        )}

        {/* Step 2: team name */}
        {step === 2 && selectedTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Info size={14} color="#58A6FF" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedTemplate.display_name} — {selectedTemplate.description}</span>
            </div>
            <div>
              <label className="label">{t.teams.createModal.label} *</label>
              <input className="input" placeholder={t.teams.createModal.placeholder} value={formName}
                onChange={e => setFormName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setStep(1)}>{t.teams.createModal.back}</button>
              <button className="btn-primary" onClick={handleCreate} disabled={submitting || !formName.trim()}>
                {submitting ? t.common.loading : t.teams.createModal.submit}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Settings modal — opened from LeftNav user menu */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} lang={lang} />
      )}
    </div>
  )
}

// Export wrapped in Suspense for useSearchParams compatibility
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
