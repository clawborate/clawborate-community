'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TemplateCard from '@/components/templates/TemplateCard'
import StatusFilter from '@/components/templates/StatusFilter'
import EmptyState from '@/components/templates/EmptyState'
import SkeletonCard from '@/components/templates/SkeletonCard'
import type { CommunityTemplate, StatusFilterValue } from '@/components/templates/types'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

const API = '/api/templates'

interface TemplateApiResponse {
  id: string
  name: string
  description?: string
  source?: string
  template_type?: string
  content?: string
  is_approved?: boolean
  approval_status?: string
  rejection_reason?: string
  is_recommended?: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
  // from community template
  screenshot_url?: string | null
  rating?: number | null
  rating_count?: number
}

function isAdminRole(role: string | null): boolean {
  return role === 'platform_admin' || role === 'team_admin'
}

// Map API response to our TemplateCard props
function toCard(t: TemplateApiResponse, userName: string, admin: boolean) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    screenshot_url: t.screenshot_url ?? null,
    is_recommended: t.is_recommended ?? false,
    approval_status: (t.approval_status ?? (t.is_approved ? 'approved' : 'pending')) as 'pending' | 'approved' | 'rejected',
    rating: t.rating ?? null,
    rating_count: t.rating_count ?? 0,
    contributor_name: t.created_by ? userName : 'system',
    created_at: t.created_at ?? new Date().toISOString(),
    tags: t.template_type ? [t.template_type] : [],
    is_admin: admin,
  }
}

export default function TemplatesPage() {
  const { user } = useAuth()
  const admin = isAdminRole(user?.role ?? null)

  const [templates, setTemplates] = useState<CommunityTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilterValue>('all')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<StatusFilterValue, number>>({ pending: 0, approved: 0, rejected: 0, all: 0 })
  const [error, setError] = useState('')

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('type', 'community')
      if (status !== 'all') params.set('status', status)

      let resJson: any[]
      try {
        resJson = await api.listCommunityTemplates(status !== 'all' ? { status } : { type: 'community' })
      } catch (e: any) {
        if (status !== 'all' && (e?.message?.includes('403') || e?.status === 403)) {
          setStatus('all')
          return
        }
        throw e
      }
      const data: TemplateApiResponse[] = resJson

      const mapped: CommunityTemplate[] = data.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description ?? '',
        screenshot_url: t.screenshot_url ?? null,
        is_recommended: t.is_recommended ?? false,
        approval_status: (t.approval_status ?? (t.is_approved ? 'approved' : 'pending')) as 'pending' | 'approved' | 'rejected',
        rating: t.rating ?? null,
        rating_count: t.rating_count ?? 0,
        contributor_name: t.created_by ?? 'system',
        created_at: t.created_at ?? new Date().toISOString(),
        tags: t.template_type ? [t.template_type] : [],
      }))
      setTemplates(mapped)

      // Update counts (only for admin with status filter)
      if (admin) {
        setCounts({
          approved: mapped.filter(t => t.approval_status === 'approved').length,
          pending: mapped.filter(t => t.approval_status === 'pending').length,
          rejected: mapped.filter(t => t.approval_status === 'rejected').length,
          all: mapped.length,
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [status, admin])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Admin action handlers — refetch after action
  const handleApprove = useCallback(() => { fetchTemplates() }, [fetchTemplates])
  const handleReject = useCallback(() => { fetchTemplates() }, [fetchTemplates])

  // Filter by search
  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Separate recommended for highlight section
  const recommended = filtered.filter(t => t.is_recommended)
  const regular = filtered.filter(t => !t.is_recommended)

  const emptyMessage = loading
    ? ''
    : search
      ? `未找到匹配 "${search}" 的模板`
      : status === 'pending'
        ? '目前没有待审核的模板'
        : status === 'approved'
          ? '暂无已批准的模板'
          : '还没有社区模板，成为第一个投稿人！'

  const gridCols = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

  return (
    <div className="min-h-screen bg-[var(--bg-base,#0D1117)]">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary,#E6EDF3)]">社区模板库</h1>
            <p className="text-sm text-[var(--text-secondary,#8B949E)] mt-1">Browse and contribute community templates</p>
          </div>
          <Link href="/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent,#58A6FF)] text-white hover:opacity-90 transition-opacity">
            Contribute ▶
          </Link>
        </div>

        {/* Status filter */}
        <div className="mb-4">
          <StatusFilter value={status} onChange={setStatus} counts={counts} />
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索模板…"
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-card,#21262D)] border border-[var(--border-default,#30363D)] text-[var(--text-primary,#E6EDF3)] placeholder-[var(--text-secondary,#8B949E)] focus:outline-none focus:border-[var(--accent,#58A6FF)]"
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-[var(--color-danger,#F85149)] mb-4">{error}</p>
            <button onClick={fetchTemplates} className="px-4 py-2 rounded-lg text-sm bg-[var(--accent,#58A6FF)] text-white hover:opacity-90">
              重试
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className={gridCols}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            message={emptyMessage}
            ctaLabel={status === 'all' && !search ? 'Contribute ▶' : undefined}
            onCta={status === 'all' && !search ? () => window.location.href = '/templates/new' : undefined}
          />
        )}

        {/* Content */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Recommended section */}
            {recommended.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-[var(--color-warning,#D29922)] uppercase tracking-wider mb-3">★ 推荐模板</h2>
                <div className={gridCols}>
                  {recommended.map(t => (
                    <TemplateCard key={t.id} {...t} is_admin={admin} onApprove={handleApprove} onReject={handleReject} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular templates */}
            {regular.length > 0 && (
              <div className={gridCols}>
                {regular.map(t => (
                  <TemplateCard key={t.id} {...t} is_admin={admin} onApprove={handleApprove} onReject={handleReject} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
