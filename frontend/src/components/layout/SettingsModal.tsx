'use client'
import { X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useLang } from '@/hooks/useLang'
import type { Lang } from '@/lib/locales'

interface Props {
  onClose: () => void
  lang: Lang
}

export default function SettingsModal({ onClose, lang }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang: currentLang, toggle: toggleLang } = useLang()

  const seg = (active: boolean) => ({
    padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
    background: active ? 'var(--accent)' : 'var(--bg-base)',
    color: active ? '#fff' : 'var(--text-secondary)',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties)

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 400, maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 12, zIndex: 101, padding: '24px',
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{lang === 'zh' ? '设置' : 'Settings'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
            <X size={16} />
          </button>
        </div>

        {/* Appearance */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            {lang === 'zh' ? '外观' : 'Appearance'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{lang === 'zh' ? '主题' : 'Theme'}</span>
              <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
                <button onClick={() => theme === 'light' && toggleTheme()} style={seg(theme === 'dark')}>Dark</button>
                <button onClick={() => theme === 'dark' && toggleTheme()} style={seg(theme === 'light')}>Light</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{lang === 'zh' ? '语言' : 'Language'}</span>
              <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
                <button onClick={() => currentLang === 'zh' && toggleLang()} style={seg(currentLang === 'en')}>EN</button>
                <button onClick={() => currentLang === 'en' && toggleLang()} style={seg(currentLang === 'zh')}>中文</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
