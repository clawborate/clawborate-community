import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  let data: Record<string, unknown>
  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) {
      // Refresh token expired or invalid — clear all auth cookies
      const response = NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
      response.cookies.delete('access_token')
      response.cookies.delete('refresh_token')
      response.cookies.delete('user_info')
      return response
    }
    data = await res.json()
  } catch {
    return NextResponse.json({ error: '无法连接到服务器' }, { status: 502 })
  }

  const isProd = process.env.SECURE_COOKIES === 'true'
  const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' }

  const response = NextResponse.json({ user: data.user })
  response.cookies.set('access_token', data.access_token as string, {
    ...cookieBase,
    maxAge: 60 * 60,
  })
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
