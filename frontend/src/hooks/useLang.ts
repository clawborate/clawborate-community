'use client'
import { useState, useEffect } from 'react'
import type { Lang } from '@/lib/locales'

export function useLang() {
  const [lang, setLang] = useState<Lang>('en')
  useEffect(() => {
    const saved = localStorage.getItem('clawborate-lang') as Lang | null
    if (saved) setLang(saved)
  }, [])
  const toggle = () => {
    const next: Lang = lang === 'en' ? 'zh' : 'en'
    setLang(next)
    localStorage.setItem('clawborate-lang', next)
  }
  return { lang, toggle }
}
