'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Bot, Moon, Sun, Settings } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useLang } from '@/hooks/useLang'
import { getT } from '@/lib/locales'
import SettingsModal from './SettingsModal'

export default function Header({ awaitingDecisions = 0 }: { awaitingDecisions?: number }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, toggle: toggleLang } = useLang()
  const t = getT(lang)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header style={{ height: 56, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 40 }}>
      <Link href="/app" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
        <Bot size={20} color="var(--color-cta)" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>clawborate</span>
      </Link>
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        <Link href="/app" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 14, color: 'var(--text-secondary)' }}>{t.nav.teams}</Link>
        <Link href="/tasks" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 14, color: 'var(--text-secondary)', position: 'relative' }}>
          {t.nav.tasks}
          {awaitingDecisions > 0 && (
            <span style={{ position: 'absolute', top: -2, right: -6, background: '#D29922', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{awaitingDecisions}</span>
          )}
        </Link>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={toggleLang} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {lang === 'en' ? 'EN' : '中'}
        </button>
        <button className="btn-icon" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button className="btn-icon" onClick={() => setSettingsOpen(true)}><Settings size={16} /></button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} lang={lang} />}
    </header>
  )
}
