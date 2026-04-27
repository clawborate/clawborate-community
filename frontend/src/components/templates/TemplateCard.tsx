'use client'

/**
 * TemplateCard — displays a community template in list/grid views.
 *
 * ⚠️ `is_admin` is a UX-only flag for rendering admin action buttons.
 * The backend enforces its own role checks on approve/reject endpoints;
 * this client-side flag does NOT serve as a security boundary.
 */

import Link from 'next/link'
import { useState } from 'react'
import type { TemplateCardProps } from './types'
import RejectModal from './RejectModal'

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
  pending: 'var(--color-warning)',
}

// ── component ──────────────────────────────────────────────────────────────

export default function TemplateCard({
  id, name, description, screenshot_url, is_recommended,
  approval_status, rating, rating_count, contributor_name,
  created_at, tags, is_admin, onApprove, onReject,
}: TemplateCardProps) {
  const [showReject, setShowReject] = useState(false)
  const [toast, setToast] = useState('')
  const [hovered, setHovered] = useState(false)

  const statusColor = STATUS_COLORS[approval_status] ?? 'var(--text-secondary)'
  const maxTags = tags?.slice(0, 3) ?? []
  const tagOverflow = (tags?.length ?? 0) > 3 ? `+${(tags?.length ?? 0) - 3}` : null

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/templates/${id}/approve`, { method: 'PUT' })
      if (res.ok) {
        showToast('Template approved')
        onApprove?.(id)
      }
    } catch { /* ignore */ }
  }

  const handleRejectConfirm = async (reason: string) => {
    try {
      const res = await fetch(`/api/templates/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      if (res.ok) {
        showToast('Template rejected')
        onReject?.(id)
      }
    } catch { /* ignore */ }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg, 8px)',
        border: is_recommended
          ? '1px solid var(--color-warning, #D29922)'
          : `1px solid ${hovered ? 'var(--accent, #58A6FF)' : 'var(--border-default, #30363D)'}`,
        background: 'var(--bg-card, #21262D)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 12px rgba(88,166,255,0.15)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 220,
      }}
    >
      {/* Recommended ribbon */}
      {is_recommended && (
        <div style={{
          position: 'absolute', top: 8, left: -28, zIndex: 2,
          background: 'var(--color-warning, #D29922)', color: '#000',
          fontSize: 10, fontWeight: 700, padding: '2px 32px',
          transform: 'rotate(-45deg)', letterSpacing: '.5px',
        }}>★ 推荐</div>
      )}

      {/* Screenshot area — 16:9 */}
      <Link href={`/templates/${id}`} style={{ display: 'block', width: '100%', paddingTop: '56.25%', background: 'var(--bg-hover, #30363D)', position: 'relative' }}>
        {screenshot_url
          ? <img src={screenshot_url} alt={name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #8B949E)', fontSize: 13 }}>
                No screenshot
              </div>
            )
        }
      </Link>

      {/* Card body */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Name */}
        <Link href={`/templates/${id}`}
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #E6EDF3)', textDecoration: 'none', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {name}
        </Link>

        {/* Contributor + time */}
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B949E)' }}>
          @{contributor_name} · {timeAgo(created_at)}
        </div>

        {/* Tags */}
        {maxTags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {maxTags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--radius-sm, 4px)', background: 'var(--bg-hover, #30363D)', color: 'var(--text-secondary, #8B949E)' }}>{t}</span>
            ))}
            {tagOverflow && (
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--radius-sm, 4px)', background: 'var(--bg-hover, #30363D)', color: 'var(--text-secondary, #8B949E)' }}>{tagOverflow}</span>
            )}
          </div>
        )}

        {/* Status + rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, padding: '2px 8px', borderRadius: 'var(--radius-sm, 4px)', border: `1px solid ${statusColor}`, textTransform: 'capitalize' }}>
            {approval_status}
          </span>
          {rating != null && rating_count != null && rating_count > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-warning, #D29922)' }}>
              ★ {rating.toFixed(1)} ({rating_count})
            </span>
          )}
        </div>

        {/* Admin action buttons for pending templates */}
        {is_admin && approval_status === 'pending' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border-default, #30363D)', paddingTop: 8 }}>
            <button onClick={handleApprove}
              style={{ flex: 1, padding: '5px 0', borderRadius: 'var(--radius-md, 6px)', border: 'none', background: 'var(--accent, #58A6FF)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Approve
            </button>
            <button onClick={() => setShowReject(true)}
              style={{ flex: 1, padding: '5px 0', borderRadius: 'var(--radius-md, 6px)', border: 'none', background: 'var(--color-danger, #F85149)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✕ Reject
            </button>
          </div>
        )}
      </div>

      {/* Reject modal */}
      <RejectModal open={showReject} onClose={() => setShowReject(false)} onConfirm={handleRejectConfirm} />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-surface, #161B22)', border: '1px solid var(--border-default, #30363D)', color: 'var(--text-primary, #E6EDF3)', fontSize: 13, padding: '6px 16px', borderRadius: 'var(--radius-md, 6px)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
