'use client'

export default function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Screenshot placeholder */}
      <div
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: 'var(--bg-hover)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(88,166,255,0.06) 50%, transparent 100%)',
            animation: 'shimmer 1.8s ease-in-out infinite',
          }}
        />
      </div>

      {/* Body */}
      <div style={{ padding: 14 }}>
        {/* Title lines */}
        <div
          style={{
            height: 14,
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 8,
            width: '80%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(88,166,255,0.06) 50%, transparent 100%)',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        </div>
        <div
          style={{
            height: 10,
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
            width: '60%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(88,166,255,0.06) 50%, transparent 100%)',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        </div>

        {/* Contributor line */}
        <div
          style={{
            height: 10,
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 10,
            width: '45%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(88,166,255,0.06) 50%, transparent 100%)',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        </div>

        {/* Tag placeholders */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[48, 56, 42].map((w, i) => (
            <div
              key={i}
              style={{
                height: 20,
                width: w,
                background: 'var(--bg-hover)',
                borderRadius: 'var(--radius-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(88,166,255,0.06) 50%, transparent 100%)',
                  animation: 'shimmer 1.8s ease-in-out infinite',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
