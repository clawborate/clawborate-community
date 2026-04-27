import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001'

// Paths that don't require authentication
const PUBLIC_PATHS = ['/', '/about', '/login', '/auth/callback']

// Paths restricted to platform_admin only
const ADMIN_ONLY_PATHS = ['/admin']

// Paths accessible to team_admin and above (not employee/guest)
const TEAM_ADMIN_PATHS = ['/settings']

function getUserRole(request: NextRequest): string | null {
  const userInfoRaw = request.cookies.get('user_info')?.value
  if (!userInfoRaw) return null
  try {
    const user = JSON.parse(decodeURIComponent(userInfoRaw))
    return user?.role ?? null
  } catch {
    return null
  }
}

/**
 * Try to refresh the access token using the refresh_token cookie.
 * Returns new token data on success, null on failure.
 */
async function tryRefresh(refreshToken: string): Promise<{ access_token: string; user: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function setAuthCookies(response: NextResponse, accessToken: string, user: Record<string, unknown>) {
  const isProd = process.env.SECURE_COOKIES === 'true'
  response.cookies.set('access_token', accessToken, {
    httpOnly: true, secure: isProd, sameSite: 'lax', path: '/',
    maxAge: 60 * 60,
  })
  response.cookies.set('user_info', JSON.stringify(user), {
    secure: isProd, sameSite: 'lax', path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set('token_expiry', String(Math.floor(Date.now() / 1000) + 3600), {
    secure: isProd, sameSite: 'lax', path: '/',
    maxAge: 60 * 60,
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Next.js API routes for auth (/api/auth/*) — let them pass through as-is
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // For backend-proxied API calls (/api/*): inject Authorization header from httpOnly cookie
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('access_token')?.value
    if (token) {
      const headers = new Headers(request.headers)
      headers.set('Authorization', `Bearer ${token}`)
      return NextResponse.next({ request: { headers } })
    }
    // No access token — try refresh before letting backend return 401
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      const data = await tryRefresh(refreshToken)
      if (data) {
        const headers = new Headers(request.headers)
        headers.set('Authorization', `Bearer ${data.access_token}`)
        const response = NextResponse.next({ request: { headers } })
        setAuthCookies(response, data.access_token, data.user as Record<string, unknown>)
        return response
      }
    }
    return NextResponse.next()
  }

  // For page routes: redirect to /login if not authenticated
  const token = request.cookies.get('access_token')?.value
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (!token && !isPublic) {
    // Try refresh before redirecting to login
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      const data = await tryRefresh(refreshToken)
      if (data) {
        // Redirect to same page — browser stores new cookies, then loads the page
        const response = NextResponse.redirect(request.url)
        setAuthCookies(response, data.access_token, data.user as Record<string, unknown>)
        return response
      }
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based access control (only applies to authenticated users)
  if (token) {
    const role = getUserRole(request)

    // Admin-only pages → redirect non-admins to home
    if (ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))) {
      if (role !== 'platform_admin') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    // Team-admin+ pages → redirect employee/guest to home
    if (TEAM_ADMIN_PATHS.some(p => pathname.startsWith(p))) {
      if (role !== 'platform_admin' && role !== 'team_admin') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
