'use client'
import type { ReactNode } from 'react'

interface Props {
  illustration?: ReactNode
  message: string
  ctaLabel?: string
  onCta?: () => void
}

export default function EmptyState({ illustration, message, ctaLabel, onCta }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.5 }}>
        {illustration ?? '📭'}
      </div>
      <p
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          marginBottom: ctaLabel ? 20 : 0,
          maxWidth: 360,
        }}
      >
        {message}
      </p>
      {ctaLabel && onCta && (
        <button className="btn-primary" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
