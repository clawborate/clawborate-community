'use client'

type StatusFilterValue = 'pending' | 'approved' | 'rejected' | 'all'

interface Props {
  value: StatusFilterValue
  onChange: (value: StatusFilterValue) => void
  counts: Record<StatusFilterValue, number>
}

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export default function StatusFilter({ value, onChange, counts }: Props) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: 3,
        gap: 2,
      }}
    >
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              background: isSelected ? 'var(--accent)' : 'transparent',
              color: isSelected ? '#fff' : 'var(--text-secondary)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
              }
            }}
          >
            {opt.label} ({counts[opt.value] ?? 0})
          </button>
        )
      })}
    </div>
  )
}
