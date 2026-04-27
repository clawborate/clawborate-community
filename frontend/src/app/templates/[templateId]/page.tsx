'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { marked } from 'marked'
import { api, TemplateAgent } from '@/lib/api'

// ── Types ────────────────────────────────────────────────────────────────

interface TemplateDetail {
  id: string
  display_name: string
  contributor: string
  description: string
  content: string
  status: 'approved' | 'rejected' | 'pending'
  type: string
  rating: number
  rating_count: number
  last_updated: string
  tags: string[]
  screenshot_url?: string
  agents?: TemplateAgent[]
}

type FetchState = 'loading' | 'success' | 'error'

// ── Helpers ──────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return dateStr
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`
}

const STATUS_CONFIG: Record<TemplateDetail['status'], { label: string; color: string; bg: string; icon: string }> = {
  approved:  { label: 'Approved',  color: '#3FB950', bg: 'rgba(63,185,80,0.12)',  icon: '✓' },
  rejected:  { label: 'Rejected',  color: '#F85149', bg: 'rgba(248,81,73,0.12)',  icon: '✕' },
  pending:   { label: 'Pending',   color: '#D29922', bg: 'rgba(210,153,34,0.12)', icon: '◷' },
}

// ── Components ───────────────────────────────────────────────────────────

function SkeletonPage() {
  return (
    <div className="template-detail-page">
      <div className="template-detail-header">
        <div className="skeleton-line skeleton-back" style={{ width: 180, height: 20, borderRadius: 4 }} />
      </div>
      <div className="template-detail-body">
        <div className="template-detail-content">
          <div className="skeleton-block" style={{ width: '100%', paddingTop: '56.25%', borderRadius: 8 }} />
          <div style={{ marginTop: 24 }}>
            <div className="skeleton-line" style={{ width: '60%', height: 24, borderRadius: 4 }} />
            <div className="skeleton-line" style={{ width: '80%', height: 16, borderRadius: 4, marginTop: 12 }} />
            <div className="skeleton-line" style={{ width: '70%', height: 16, borderRadius: 4, marginTop: 8 }} />
          </div>
          <div style={{ marginTop: 32 }}>
            <div className="skeleton-line" style={{ width: '30%', height: 20, borderRadius: 4 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14, borderRadius: 4, marginTop: 12 }} />
            <div className="skeleton-line" style={{ width: '90%', height: 14, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: '95%', height: 14, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: '60%', height: 14, borderRadius: 4, marginTop: 8 }} />
          </div>
        </div>
        <div className="template-detail-sidebar">
          <div className="skeleton-line" style={{ width: '70%', height: 28, borderRadius: 4 }} />
          <div className="skeleton-line" style={{ width: '40%', height: 16, borderRadius: 4, marginTop: 8 }} />
          <div style={{ marginTop: 16 }}>
            <div className="skeleton-line" style={{ width: '50%', height: 14, borderRadius: 4 }} />
            <div className="skeleton-line" style={{ width: '45%', height: 14, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: '55%', height: 14, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: '40%', height: 14, borderRadius: 4, marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: '35%', height: 14, borderRadius: 4, marginTop: 8 }} />
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
            <div className="skeleton-line" style={{ width: 100, height: 36, borderRadius: 6 }} />
            <div className="skeleton-line" style={{ width: 70, height: 36, borderRadius: 6 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function TemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState('')
  const [data, setData] = useState<TemplateDetail | null>(null)
  const [state, setState] = useState<FetchState>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    params.then(p => setTemplateId(p.templateId))
  }, [params])

  const fetchTemplate = useCallback(async () => {
    if (!templateId) return
    setState('loading')
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Failed to load template')
      }
      const json = await res.json()
      setData(json)
      setState('success')
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }, [templateId])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  const handleRetry = () => {
    fetchTemplate()
  }

  const handleUseTemplate = () => {
    showToast('功能开发中')
  }

  const handleStar = () => {
    showToast('功能开发中')
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('链接已复制到剪贴板')
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      showToast('链接已复制到剪贴板')
    }
  }

  const statusCfg = data ? STATUS_CONFIG[data.status] : null

  const markdownHtml = data?.content ? marked.parse(data.content, { async: false }) as string : ''

  return (
    <>
      <ToastContainer />
      <div className="template-detail-page">
        {/* Header */}
        <div className="template-detail-header">
          <Link href="/templates" className="back-link">
            <span className="back-arrow">←</span> Back to Templates
          </Link>
        </div>

        {/* Content */}
        {state === 'loading' && <SkeletonPage />}

        {state === 'error' && (
          <div className="template-error">
            <div className="error-icon">⚠</div>
            <h2>Failed to load template</h2>
            <p>{errMsg}</p>
            <button className="retry-btn" onClick={handleRetry}>Retry</button>
          </div>
        )}

        {state === 'success' && data && (
          <div className="template-detail-body">
            {/* Left: Content */}
            <div className="template-detail-content">
              {/* Screenshot */}
              {data.screenshot_url ? (
                <img src={data.screenshot_url} alt={data.display_name} className="template-screenshot" />
              ) : (
                <div className="template-screenshot-placeholder">
                  <span>📷</span>
                </div>
              )}

              {/* Description */}
              {data.description && (
                <section className="template-section">
                  <h2 className="section-title">Description</h2>
                  <p className="template-description">{data.description}</p>
                </section>
              )}

              {/* Content (Markdown) */}
              {data.content && (
                <section className="template-section">
                  <h2 className="section-title">Content</h2>
                  <div
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: markdownHtml }}
                  />
                </section>
              )}
            </div>

            {/* Right: Sidebar */}
            <aside className="template-detail-sidebar">
              <h1 className="template-title">{data.display_name}</h1>
              <p className="template-contributor">by @{data.contributor}</p>

              <div className="template-divider" />

              {/* Meta info */}
              <div className="template-meta">
                {statusCfg && (
                  <div className="meta-row">
                    <span className="meta-label">Status:</span>
                    <span
                      className="status-badge"
                      style={{ color: statusCfg.color, background: statusCfg.bg }}
                    >
                      <span className="status-icon">{statusCfg.icon}</span>
                      {statusCfg.label}
                    </span>
                  </div>
                )}
                <div className="meta-row">
                  <span className="meta-label">Type:</span>
                  <span className="meta-value">{data.type}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Rating:</span>
                  <span className="meta-value">
                    ★ {data.rating.toFixed(1)} ({data.rating_count})
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Last updated:</span>
                  <span className="meta-value">{getRelativeTime(data.last_updated)}</span>
                </div>
              </div>

              {/* Tags */}
              {data.tags.length > 0 && (
                <div className="template-tags">
                  {data.tags.map((tag) => (
                    <span key={tag} className="tag-badge">{tag}</span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="template-actions">
                <button className="btn-primary" onClick={handleUseTemplate}>
                  Use Template ▶
                </button>
                <div className="btn-row">
                  <button className="btn-secondary" onClick={handleStar}>
                    ⭐ Star
                  </button>
                  <button className="btn-secondary" onClick={handleShare}>
                    📤 Share
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* ── Styles ────────────────────────────────────────────────────── */}
      <style>{`
        .template-detail-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          color: var(--text-primary, #E6EDF3);
          min-height: 100vh;
        }

        /* Header */
        .template-detail-header {
          margin-bottom: 24px;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--accent, #58A6FF);
          text-decoration: none;
          font-size: 14px;
          transition: opacity 0.15s;
        }
        .back-link:hover {
          opacity: 0.8;
        }
        .back-arrow {
          font-size: 16px;
        }

        /* Body: Two-column layout */
        .template-detail-body {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
        }
        @media (max-width: 900px) {
          .template-detail-body {
            grid-template-columns: 1fr;
          }
        }

        /* Left: Content */
        .template-detail-content {
          min-width: 0;
        }

        .template-screenshot {
          width: 100%;
          border-radius: var(--radius-lg, 8px);
          border: 1px solid var(--border-default, #30363D);
          display: block;
        }
        .template-screenshot-placeholder {
          width: 100%;
          padding-top: 56.25%;
          background: var(--bg-surface, #161B22);
          border-radius: var(--radius-lg, 8px);
          border: 1px solid var(--border-default, #30363D);
          position: relative;
        }
        .template-screenshot-placeholder span {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px;
          opacity: 0.4;
        }

        .template-section {
          margin-top: 32px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary, #E6EDF3);
        }
        .template-description {
          color: var(--text-secondary, #8B949E);
          line-height: 1.6;
          font-size: 15px;
        }

        /* Markdown styles */
        .markdown-body :global(h1) {
          font-size: 24px;
          font-weight: 700;
          margin: 24px 0 12px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(h2) {
          font-size: 20px;
          font-weight: 600;
          margin: 20px 0 10px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(h3) {
          font-size: 18px;
          font-weight: 600;
          margin: 18px 0 8px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(h4) {
          font-size: 16px;
          font-weight: 600;
          margin: 16px 0 8px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(h5) {
          font-size: 14px;
          font-weight: 600;
          margin: 14px 0 6px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(h6) {
          font-size: 13px;
          font-weight: 600;
          margin: 12px 0 6px;
          color: var(--text-secondary, #8B949E);
        }
        .markdown-body :global(p) {
          margin: 12px 0;
          line-height: 1.6;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(ul),
        .markdown-body :global(ol) {
          padding-left: 24px;
          margin: 12px 0;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(li) {
          margin: 4px 0;
          line-height: 1.5;
        }
        .markdown-body :global(pre) {
          background: var(--bg-surface, #161B22);
          border-radius: var(--radius-sm, 4px);
          border-left: 3px solid var(--accent, #58A6FF);
          padding: 16px;
          overflow-x: auto;
          margin: 16px 0;
        }
        .markdown-body :global(code) {
          background: var(--bg-surface, #161B22);
          padding: 2px 6px;
          border-radius: var(--radius-sm, 4px);
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 13px;
          color: var(--text-primary, #E6EDF3);
        }
        .markdown-body :global(pre code) {
          background: transparent;
          padding: 0;
          border-radius: 0;
        }
        .markdown-body :global(blockquote) {
          border-left: 3px solid var(--text-secondary, #8B949E);
          padding-left: 16px;
          margin: 16px 0;
          color: var(--text-secondary, #8B949E);
          font-style: italic;
        }
        .markdown-body :global(img) {
          max-width: 100%;
          border-radius: var(--radius-lg, 8px);
          margin: 16px 0;
        }
        .markdown-body :global(a) {
          color: var(--accent, #58A6FF);
          text-decoration: none;
        }
        .markdown-body :global(a:hover) {
          text-decoration: underline;
        }
        .markdown-body :global(table) {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        .markdown-body :global(th),
        .markdown-body :global(td) {
          border: 1px solid var(--border-default, #30363D);
          padding: 8px 12px;
          text-align: left;
        }
        .markdown-body :global(th) {
          background: var(--bg-surface, #161B22);
          font-weight: 600;
        }

        /* Right: Sidebar */
        .template-detail-sidebar {
          position: sticky;
          top: 24px;
          align-self: start;
        }
        @media (max-width: 900px) {
          .template-detail-sidebar {
            position: static;
          }
        }

        .template-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          color: var(--text-primary, #E6EDF3);
        }
        .template-contributor {
          margin: 4px 0 0;
          color: var(--text-secondary, #8B949E);
          font-size: 14px;
        }

        .template-divider {
          height: 1px;
          background: var(--border-default, #30363D);
          margin: 16px 0;
        }

        .template-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .meta-label {
          color: var(--text-secondary, #8B949E);
          min-width: 90px;
        }
        .meta-value {
          color: var(--text-primary, #E6EDF3);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--radius-sm, 4px);
          font-size: 12px;
          font-weight: 500;
        }
        .status-icon {
          font-size: 10px;
        }

        /* Tags */
        .template-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 16px;
        }
        .tag-badge {
          display: inline-block;
          background: var(--bg-card, #21262D);
          color: var(--text-secondary, #8B949E);
          font-size: 12px;
          padding: 2px 10px;
          border-radius: 12px;
          border: 1px solid var(--border-default, #30363D);
        }

        /* Actions */
        .template-actions {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 20px;
          background: var(--accent, #58A6FF);
          color: #0D1117;
          border: none;
          border-radius: var(--radius-md, 6px);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary:hover {
          background: #4c9aef;
        }
        .btn-row {
          display: flex;
          gap: 8px;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--bg-card, #21262D);
          color: var(--text-primary, #E6EDF3);
          border: 1px solid var(--border-default, #30363D);
          border-radius: var(--radius-md, 6px);
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          flex: 1;
        }
        .btn-secondary:hover {
          background: var(--bg-hover, #30363D);
        }

        /* Skeleton */
        .skeleton-line {
          background: linear-gradient(90deg, var(--bg-surface, #161B22) 25%, var(--bg-card, #21262D) 50%, var(--bg-surface, #161B22) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .skeleton-block {
          background: linear-gradient(90deg, var(--bg-surface, #161B22) 25%, var(--bg-card, #21262D) 50%, var(--bg-surface, #161B22) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Error */
        .template-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px;
          text-align: center;
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .template-error h2 {
          font-size: 20px;
          margin: 0 0 8px;
          color: var(--text-primary, #E6EDF3);
        }
        .template-error p {
          color: var(--text-secondary, #8B949E);
          margin: 0 0 24px;
        }
        .retry-btn {
          padding: 8px 20px;
          background: var(--accent, #58A6FF);
          color: #0D1117;
          border: none;
          border-radius: var(--radius-md, 6px);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .retry-btn:hover {
          background: #4c9aef;
        }

        /* Toast */
        .toast-container {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .toast-item {
          background: var(--bg-card, #21262D);
          color: var(--text-primary, #E6EDF3);
          border: 1px solid var(--border-default, #30363D);
          padding: 10px 20px;
          border-radius: var(--radius-md, 6px);
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          animation: toastIn 0.2s ease-out;
        }
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
}

let toastId = 0
let setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null

function ToastContainer() {
  const [toasts, setToastsState] = useState<Toast[]>([])
  setToasts = setToastsState

  return toasts.length > 0 ? (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item">{t.message}</div>
      ))}
    </div>
  ) : null
}

function showToast(message: string) {
  if (!setToasts) return
  const id = ++toastId
  setToasts((prev) => [...prev, { id, message }])
  setTimeout(() => {
    setToasts!((prev) => prev.filter((t) => t.id !== id))
  }, 2500)
}
