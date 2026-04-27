import type { ReactNode } from 'react'

export interface CommunityTemplate {
  id: string
  name: string
  description: string
  screenshot_url?: string | null
  is_recommended: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  rating?: number | null
  rating_count?: number
  contributor_name: string
  created_at: string
  tags?: string[]
}

export type TabType = 'official' | 'community'
export type StatusFilterValue = 'pending' | 'approved' | 'rejected' | 'all'

export interface TemplateCardProps {
  id: string
  name: string
  description: string
  screenshot_url?: string | null
  is_recommended: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  rating?: number | null
  rating_count?: number
  contributor_name: string
  created_at: string
  tags?: string[]
  is_admin: boolean
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export interface StatusFilterProps {
  value: StatusFilterValue
  onChange: (value: StatusFilterValue) => void
  counts: Record<StatusFilterValue, number>
}

export interface EmptyStateProps {
  illustration?: ReactNode
  message: string
  ctaLabel?: string
  onCta?: () => void
}

export interface RejectModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}
