import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  const { code, redirect_uri } = await request.json()

  if (!code || !redirect_uri) {
    return NextResponse.json({ error: 'Missing code or redirect_uri' }, { status: 400 })
  }

  let data: Record<string, unknown>
  try {
    const res = await fetch(`${BACKEND_URL}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'OAuth exchange failed' }))
      return NextResponse.json({ error: err.detail }, { status: res.status })
    }
    data = await res.json()
  } catch {
    return NextResponse.json({ error: 'Failed to reach auth server' }, { status: 502 })
  }

  const isProd = process.env.SECURE_COOKIES === 'true'
  const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' }

  const response = NextResponse.json({ user: data.user })

  // access_token: httpOnly, 1 hour
  response.cookies.set('access_token', data.access_token as string, {
    ...cookieBase,
    maxAge: 60 * 60,
  })
  // refresh_token: httpOnly, 30 days
  response.cookies.set('refresh_token', data.refresh_token as string, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  })
  // user_info: readable by client (for display name/email), 30 days
  response.cookies.set('user_info', JSON.stringify(data.user), {
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set('token_expiry', String(Math.floor(Date.now() / 1000) + 3600), {
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })

  return response
}
