'use client'

export default function DevOnly({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') return null
  return <>{children}</>
}
