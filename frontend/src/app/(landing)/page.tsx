'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const CubeAssembly = dynamic(() => import('@/components/login/CubeAssembly'), { ssr: false })

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

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

const translations = {
  en: {
    title: 'Agentic Teams for Business',
    subtitle: 'Empower multi-agent collaboration and boost team efficiency',
    googleLogin: 'Sign in with Google',
    register: 'Sign up',
    login: 'Already have an account?',
  },
  zh: {
    title: 'AI 团队协作平台',
    subtitle: '让多智能体协同工作，提升团队效率',
    googleLogin: '使用 Google 账号登录',
    register: '免费注册',
    login: '已有账号？登录',
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile devices (width < 768px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleGoogleLogin = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem('oauth_state', state)
    const redirectUri = `${window.location.origin}/auth/callback`
    window.location.href = getGoogleOAuthUrl(redirectUri, state)
  }

  const t = translations[lang]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', background: '#fff', overflow: isMobile ? 'auto' : 'hidden' }}>

      {/* Cube — top on mobile, right panel on desktop */}
      {isMobile && (
        <div style={{ width: '100%', height: '40vh', flexShrink: 0, position: 'relative', background: '#fff' }}>
          <CubeAssembly />
        </div>
      )}

      <div style={{
        width: isMobile ? '100%' : '52%',
        flexShrink: 0,
        padding: isMobile ? '24px 32px 48px' : '0 40px 0 72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'center',
        position: 'relative',
      }}>
        <div style={{
          position: isMobile ? 'static' : 'absolute',
          top: 40,
          left: 72,
          display: 'flex',
          gap: 8,
          marginBottom: isMobile ? 24 : 0,
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

        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#bbb',
              marginBottom: 16,
            }}>
              Clawborate
            </div>
            <h1 style={{
              fontSize: isMobile ? 32 : 38,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              color: '#111',
              marginBottom: 12,
            }}>
              {t.title}
            </h1>
            <p style={{
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.75,
              color: '#999',
            }}>
              {t.subtitle}
            </p>
          </div>

          <div style={{ maxWidth: 320 }}>
          {GOOGLE_CLIENT_ID && (
            <button
              onClick={handleGoogleLogin}
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
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                marginBottom: 16,
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
            >
              <GoogleIcon />
              {t.googleLogin}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Link
                href="/login"
                style={{
                  fontSize: 13,
                  color: '#1a6ef5',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
                onMouseOver={e => (e.currentTarget.style.textDecoration = 'none')}
                onMouseOut={e => (e.currentTarget.style.textDecoration = 'underline')}
              >
                {t.login}
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
              <GoogleIconSmall />
              <GitHubIconSmall />
              <LinkedInIconSmall />
            </div>
          </div>
          </div>
        </div>
      </div>

      {!isMobile && (
        <div style={{ flex: 1, height: '100vh', position: 'relative', minWidth: 0, background: '#fff' }}>
          <CubeAssembly />
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

// Small OAuth icons for OAuth indicator
function GoogleIconSmall() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#ccc" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#ccc" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#ccc" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#ccc" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GitHubIconSmall() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#ccc" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function LinkedInIconSmall() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#ccc" d="M20.5 2h-17a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 2.5 2.5h17a2.5 2.5 0 0 0 2.5-2.5v-15a2.5 2.5 0 0 0-2.5-2.5zm-8.5 18.5h-3v-7.5h3v7.5zm-1.5-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9.5 9h-3v-3.5a1.75 1.75 0 0 0-3.5 0v3.5h-3v-7.5h3v1a1.75 1.75 0 1 1 3.5 0v6.5h3v-2.5z" />
    </svg>
  )
}

