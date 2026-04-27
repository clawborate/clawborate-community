'use client'
/**
 * StatusTab — M3-B1 + M3-B2 + M3-B3: project status stat cards.
 *
 * 4 stat cards + 3 always-visible task lists (flat display, Issue #235):
 *   1. Pending (pending|in_progress)
 *   2. Completed (completed, month)
 *   3. Blocked (awaiting_decision|failed)
 *   4. Token usage (this month)
 *
 * Task lists rendered via shared TaskDetailTable component.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import TaskDetailTable from './TaskDetailTable'
import type { Task } from '@/types'

interface Props {
  teamId: string
}

interface Stats {
  pending:        number
  pendingTasks:   Task[]
  completed:      number
  completedTasks: Task[]
  blocked:        number
  blockedTasks:   Task[]
  tokens:         number | null
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default function StatusTab({ teamId }: Props) {
  const { lang } = useLang()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    let cancelled = false
    const loadStats = async (): Promise<void> => {
      const [tasksRes, usageRes] = await Promise.allSettled([
        api.getTasks({ team_id: teamId }),
        api.getUsageSummary(teamId),
      ])
      if (cancelled) return
      const pendingTasks: Task[] = []
      const completedTasks: Task[] = []
      const blockedTasks: Task[] = []
      let pending = 0, completed = 0, blocked = 0, tokens: number | null = null

      if (tasksRes.status === 'fulfilled') {
        for (const task of tasksRes.value.tasks ?? []) {
          if (task.status === 'pending' || task.status === 'in_progress') {
            pending++; pendingTasks.push(task)
          } else if (task.status === 'completed') {
            if (isThisMonth(task.updated_at)) { completed++; completedTasks.push(task) }
          } else if (task.status === 'awaiting_decision' || task.status === 'failed') {
            blocked++; blockedTasks.push(task)
          }
        }
      }
      if (usageRes.status === 'fulfilled') {
        const m = usageRes.value.metrics ?? {}
        tokens = (m['llm_tokens_input']?.used ?? 0) + (m['llm_tokens_output']?.used ?? 0)
      }
      completedTasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setStats({ pending, pendingTasks, completed, completedTasks, blocked, blockedTasks, tokens })
      setLoading(false)
    }
    loadStats()
    const interval = setInterval(loadStats, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamId])

  const cards = [
    { key: 'pending'   as const, label: lang === 'zh' ? '进行中'   : 'Pending',   value: stats?.pending   ?? null, color: 'var(--accent)',                                            sub: lang === 'zh' ? '个任务' : 'tasks active'  },
    { key: 'completed' as const, label: lang === 'zh' ? '已完成'   : 'Completed', value: stats?.completed ?? null, color: 'var(--success)',                                           sub: lang === 'zh' ? '本月'   : 'this month'   },
    { key: 'blocked'   as const, label: lang === 'zh' ? '阻塞'     : 'Blocked',   value: stats?.blocked   ?? null, color: stats?.blocked ? 'var(--danger)' : 'var(--text-secondary)', sub: lang === 'zh' ? '需处理' : 'need attention' },
    { key: 'tokens'    as const, label: lang === 'zh' ? 'Token 用量': 'Tokens',   value: stats?.tokens    ?? null, color: 'var(--text-primary)',                                       sub: lang === 'zh' ? '本月消耗': 'this month',   format: fmtTokens },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map(card => {
          const displayValue = loading ? null
            : card.value === null ? null
            : card.format ? card.format(card.value) : String(card.value)

          return (
            <div key={card.key}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 500 }}>{card.label}</span>
              </div>
              {loading
                ? <div style={{ height: 22, borderRadius: 6, background: 'var(--bg-card)', width: '50%', marginBottom: 4 }} />
                : <div style={{ fontSize: 22, fontWeight: 700, color: displayValue !== null ? card.color : 'var(--text-muted)', lineHeight: 1, marginBottom: 4 }}>{displayValue ?? '—'}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Pending tasks — always visible */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          {lang === 'zh' ? '进行中任务' : 'Active Tasks'}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <TaskDetailTable
            tasks={stats?.pendingTasks ?? []}
            loading={loading}
            emptyText={lang === 'zh' ? '暂无进行中的任务' : 'No active tasks'}
            lang={lang}
          />
        </div>
      </div>

      {/* Completed tasks — always visible */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          {lang === 'zh' ? '本月已完成' : 'Completed This Month'}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <TaskDetailTable
            tasks={stats?.completedTasks ?? []}
            loading={loading}
            emptyText={lang === 'zh' ? '本月暂无已完成任务' : 'No completed tasks this month'}
            lang={lang}
          />
        </div>
      </div>

      {/* Blocked tasks — always visible */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          {lang === 'zh' ? '阻塞任务' : 'Blocked Tasks'}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <TaskDetailTable
            tasks={stats?.blockedTasks ?? []}
            loading={loading}
            emptyText={lang === 'zh' ? '暂无阻塞任务' : 'No blocked tasks'}
            lang={lang}
          />
        </div>
      </div>
    </div>
  )
}
