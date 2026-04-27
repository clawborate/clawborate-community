'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

const translations = {
  en: {
    brand: 'Clawborate',
    titleLogin: 'Welcome back',
    titleRegister: 'Create account',
    subtitleLogin: 'Sign in to continue your work',
    subtitleRegister: 'Start your AI team collaboration journey',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    placeholderName: 'Enter your name',
    placeholderEmail: 'Enter your email address',
    placeholderPassword: 'Enter your password',
    btnLogin: 'Sign in',
    btnRegister: 'Sign up',
    btnProcessing: 'Processing...',
    or: 'or',
    googleLogin: 'Sign in with Google',
    noAccount: 'No account?',
    hasAccount: 'Already have an account?',
    errorPasswordMin: 'Password must be at least 8 characters',
    errorNetwork: 'Network error, please try again',
    signupClosedTitle: 'Sign up is not open yet',
    signupClosedMessage: 'Sign up is not open yet. Please check back later.',
    close: 'Close',
  },
  zh: {
    brand: 'Clawborate',
    titleLogin: '欢迎回来',
    titleRegister: '创建账号',
    subtitleLogin: '登录以继续您的工作',
    subtitleRegister: '开始您的 AI 团队协作之旅',
    name: '姓名',
    email: '邮箱',
    password: '密码',
    placeholderName: '请输入您的姓名',
    placeholderEmail: '请输入邮箱地址',
    placeholderPassword: '请输入密码',
    btnLogin: '登录',
    btnRegister: '注册',
    btnProcessing: '处理中...',
    or: '或使用',
    googleLogin: '使用 Google 账号登录',
    noAccount: '没有账号？',
    hasAccount: '已有账号？',
    errorPasswordMin: '密码至少 8 位',
    errorNetwork: '网络错误，请重试',
    signupClosedTitle: '注册尚未开放',
    signupClosedMessage: '注册尚未开放，请稍后再试。',
    close: '关闭',
  },
}

function getGoogleOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export default function LoginPage() {
  const router = useRouter()
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [showSignupModal, setShowSignupModal] = useState(false)

  const t = translations[lang]

  const getRedirect = () => {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('redirect')
    return r && r.startsWith('/') && !r.startsWith('//') ? r : '/app'
  }

  const handleGoogleLogin = () => {
    setLoading(true)
    const state = crypto.randomUUID()
    sessionStorage.setItem('oauth_state', state)
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      sessionStorage.setItem('post_login_redirect', redirect)
    }
    const redirectUri = `${window.location.origin}/auth/callback`
    window.location.href = getGoogleOAuthUrl(redirectUri, state)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register') {
      setShowSignupModal(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.detail || t.errorNetwork)
        return
      }
      router.push(getRedirect())
    } catch {
      setError(t.errorNetwork)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Language switch - top left corner */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: 72,
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => setLang('zh')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: lang === 'zh' ? '#1a6ef5' : 'transparent',
            color: lang === 'zh' ? '#fff' : '#999',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          中文
        </button>
        <button
          onClick={() => setLang('en')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: lang === 'en' ? '#1a6ef5' : 'transparent',
            color: lang === 'en' ? '#fff' : '#999',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          EN
        </button>
      </div>

      <div style={{ width: 400, padding: 40 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#bbb',
            marginBottom: 16,
          }}>
            {t.brand}
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: -1,
            color: '#111',
            marginBottom: 8,
          }}>
            {mode === 'login' ? t.titleLogin : t.titleRegister}
          </h1>
          <p style={{
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.5,
            color: '#999',
          }}>
            {mode === 'login' ? t.subtitleLogin : t.subtitleRegister}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <div>
              <label htmlFor="name" style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: '#666',
                marginBottom: 6,
              }}>
                {t.name}
              </label>
              <input
                id="name"
                type="text"
                placeholder={t.placeholderName}
                value={name}
                required
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  background: '#fff',
                  color: '#333',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: '#666',
              marginBottom: 6,
            }}>
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              placeholder={t.placeholderEmail}
              value={email}
              required
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e0e0e0',
                background: '#fff',
                color: '#333',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
            />
          </div>
          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: '#666',
              marginBottom: 6,
            }}>
              {t.password}
            </label>
            <input
              id="password"
              type="password"
              placeholder={t.placeholderPassword}
              value={password}
              required
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e0e0e0',
                background: '#fff',
                color: '#333',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: '#f56565', margin: 0 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              borderRadius: 10,
              background: '#1a6ef5',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: 8,
            }}
          >
            {loading ? t.btnProcessing : mode === 'login' ? t.btnLogin : t.btnRegister}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
              <span style={{ fontSize: 11, color: '#999' }}>{t.or}</span>
              <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
            </div>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '12px',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                background: '#fff',
                color: '#333',
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'border-color 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
            >
              <GoogleIcon />
              {t.googleLogin}
            </button>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#999' }}>
          {mode === 'login' ? t.noAccount : t.hasAccount}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{
              background: 'none',
              border: 'none',
              color: '#1a6ef5',
              cursor: 'pointer',
              fontSize: 13,
              padding: '0 4px',
              fontWeight: 500,
            }}
          >
            {mode === 'login' ? t.btnRegister : t.btnLogin}
          </button>
        </p>
      </div>

      {/* Signup closed modal */}
      {showSignupModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowSignupModal(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 32,
              borderRadius: 12,
              maxWidth: 400,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#111',
              marginBottom: 12,
            }}>
              {t.signupClosedTitle}
            </h2>
            <p style={{
              fontSize: 14,
              color: '#666',
              marginBottom: 24,
            }}>
              {t.signupClosedMessage}
            </p>
            <button
              onClick={() => setShowSignupModal(false)}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: '#1a6ef5',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#ccc" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#ccc" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#ccc" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#ccc" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
