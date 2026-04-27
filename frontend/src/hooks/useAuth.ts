'use client'
import { useState, useEffect } from 'react'

export type UserRole = 'platform_admin' | 'team_admin' | 'employee' | 'guest'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

function parseUserInfoCookie(): AuthUser | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find(r => r.startsWith('user_info='))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')))
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setUser(parseUserInfoCookie())
  }, [])

  return {
    user,
    isAuthenticated: !!user,
    role: user?.role ?? null,
    isPlatformAdmin: user?.role === 'platform_admin',
    isTeamAdmin: user?.role === 'platform_admin' || user?.role === 'team_admin',
  }
}
