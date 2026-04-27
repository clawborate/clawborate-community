'use client'
/**
 * TaskDetailTable — shared task list panel used by StatusTab cards.
 *
 * Reused by M3-B2 (pending) and M3-B3 (completed).
 * Props:
 *   tasks     — array of Task objects to display
 *   loading   — show skeleton rows instead of data
 *   emptyText — text to show when tasks is empty and not loading
 *   lang      — 'zh' | 'en'
 */
import type { Task, TaskPriority } from '@/types'

interface Props {
  tasks: Task[]
  loading: boolean
  emptyText: string
  lang: string
}

/** Human-readable relative time */
export function relativeTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (lang === 'zh') {
    if (mins < 1)   return '刚刚'
    if (mins < 60)  return `${mins} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    return `${days} 天前`
  }
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; color: string; label: string; labelZh: string }> = {
  low:    { bg: 'rgba(139,148,158,.12)', color: 'var(--text-muted)',  label: 'Low',    labelZh: '低'   },
  normal: { bg: 'rgba(88,166,255,.12)',  color: 'var(--accent)',      label: 'Normal', labelZh: '普通' },
  high:   { bg: 'rgba(210,153,34,.15)', color: 'var(--warning)',      label: 'High',   labelZh: '高'   },
  urgent: { bg: 'rgba(248,81,73,.15)',  color: 'var(--danger)',       label: 'Urgent', labelZh: '紧急' },
}

/** Status dot color per task status */
function statusDot(status: string): string {
  switch (status) {
    case 'in_progress':       return 'var(--accent)'
    case 'completed':         return 'var(--success)'
    case 'awaiting_decision': return 'var(--warning)'
    case 'failed':            return 'var(--danger)'
    default:                  return 'var(--text-muted)'
  }
}

export default function TaskDetailTable({ tasks, loading, emptyText, lang }: Props) {
  if (loading) {
    return (
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 36, background: 'var(--bg-card)', borderRadius: 6 }} />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 70px', gap: 8, padding: '8px 16px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        <span>{lang === 'zh' ? '标题' : 'Title'}</span>
        <span>{lang === 'zh' ? '负责 Agent' : 'Agent'}</span>
        <span>{lang === 'zh' ? '更新时间' : 'Updated'}</span>
        <span>{lang === 'zh' ? '优先级' : 'Priority'}</span>
      </div>

      {/* Task rows */}
      {tasks.map((task, i) => {
        const pStyle = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal
        return (
          <div key={task.id}
            style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 70px', gap: 8, padding: '10px 16px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border-default)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
            {/* Title + status dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot(task.status), flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.title}
              </span>
            </div>
            {/* Agent */}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.assigned_agent_name ?? (lang === 'zh' ? '未分配' : 'Unassigned')}
            </span>
            {/* Updated time */}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {relativeTime(task.updated_at, lang)}
            </span>
            {/* Priority badge */}
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: pStyle.bg, color: pStyle.color, whiteSpace: 'nowrap' }}>
              {lang === 'zh' ? pStyle.labelZh : pStyle.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
