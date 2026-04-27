import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  let data: Record<string, unknown>
  try {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '注册失败' }))
      const detail = Array.isArray(err.detail)
        ? err.detail.map((e: { msg: string }) => e.msg).join('; ')
        : (err.detail ?? '注册失败')
      return NextResponse.json({ error: detail }, { status: res.status })
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
  response.cookies.set('refresh_token', data.refresh_token as string, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
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
