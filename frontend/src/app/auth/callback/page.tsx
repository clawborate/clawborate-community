'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const storedState = sessionStorage.getItem('oauth_state')

    if (!code) {
      setError('授权失败：未收到授权码')
      return
    }

    if (!state || state !== storedState) {
      setError('授权失败：安全验证不匹配，请重新登录')
      return
    }

    sessionStorage.removeItem('oauth_state')
    const raw = sessionStorage.getItem('post_login_redirect') || '/app'
    sessionStorage.removeItem('post_login_redirect')
    const postLoginRedirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app'

    const redirectUri = `${window.location.origin}/auth/callback`
    fetch('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '登录失败' }))
          throw new Error(err.error || '登录失败，请重试')
        }
        return res.json()
      })
      .then(() => { router.replace(postLoginRedirect) })
      .catch(err => { setError(err.message ?? '登录失败，请重试') })
  }, [searchParams, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-sm mx-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
          <p className="text-red-500 mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            返回登录
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">正在完成登录...</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
