'use client'
import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import { getT } from '@/lib/locales'
import type { Task, TaskStatus, TaskPriority } from '@/types'

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#8B949E', in_progress: '#58A6FF', completed: '#3FB950',
  failed: '#F85149', awaiting_decision: '#D29922',
}
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: '#8B949E', normal: '#58A6FF', high: '#D29922', urgent: '#F85149',
}
const ALL_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'failed', 'awaiting_decision']

export default function TasksPage() {
  const { lang } = useLang()
  const t = getT(lang)
  const [tasks, setTasks] = useState<Task[]>([])
  const [awaitingDecisions, setAwaitingDecisions] = useState(0)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [showDecision, setShowDecision] = useState<Task | null>(null)
  const [decisionAnswer, setDecisionAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const td = await api.getTasks()
      setTasks(td.tasks)
      setAwaitingDecisions(td.awaiting_decisions)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleDecision = async () => {
    if (!showDecision || !decisionAnswer.trim()) return
    setSubmitting(true)
    try { await api.submitDecision(showDecision.id, decisionAnswer); setShowDecision(null); setDecisionAnswer(''); refresh() }
    catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus)

  const TAB_LABELS: Record<TaskStatus | 'all', string> = {
    all: t.tasks.all, pending: t.tasks.pending, in_progress: t.tasks.inProgress,
    completed: t.tasks.completed, failed: t.tasks.failed, awaiting_decision: t.tasks.awaitingDecision,
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header awaitingDecisions={awaitingDecisions} />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t.tasks.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{tasks.length} tasks</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', marginBottom: 24, gap: 0, overflowX: 'auto' }}>
          {(['all', ...ALL_STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', color: filterStatus === s ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: filterStatus === s ? '2px solid var(--color-cta)' : '2px solid transparent', marginBottom: -1 }}>
              {TAB_LABELS[s]}
              {s === 'awaiting_decision' && awaitingDecisions > 0 && (
                <span style={{ marginLeft: 6, background: '#D29922', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{awaitingDecisions}</span>
              )}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(task => (
            <div key={task.id} className="card" style={{ cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>
                  </div>
                  {task.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{task.description}</p>}
                  {task.assigned_agent_name && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>→ {task.assigned_agent_name}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[task.status]}22`, color: STATUS_COLOR[task.status] }}>
                    {TAB_LABELS[task.status]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {task.status === 'awaiting_decision' && task.decision_question && (
                <div style={{ marginTop: 12, padding: '12px', background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.2)', borderRadius: 6 }}>
                  <p style={{ fontSize: 13, color: '#D29922', marginBottom: 8 }}>Decision Required: {task.decision_question}</p>
                  {task.decision_options && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {task.decision_options.map(opt => (
                        <button key={opt} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => { setShowDecision(task); setDecisionAnswer(opt) }}>{opt}</button>
                      ))}
                    </div>
                  )}
                  <button className="btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowDecision(task)}>
                    {t.tasks.submitDecision}
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No tasks found.</div>
          )}
        </div>
      </main>

      {/* Decision Modal */}
      <Modal open={!!showDecision} onClose={() => setShowDecision(null)} title={t.tasks.submitDecision}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {showDecision?.decision_question && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{showDecision.decision_question}</p>}
          <div>
            <label className="label">Your Answer</label>
            <input className="input" value={decisionAnswer} onChange={e => setDecisionAnswer(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowDecision(null)}>{t.common.cancel}</button>
            <button className="btn-primary" onClick={handleDecision} disabled={submitting || !decisionAnswer.trim()}>
              {submitting ? t.common.loading : t.tasks.submitDecision}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
