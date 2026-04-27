'use client'
/**
 * MDEditorDrawer — M3-F1: Markdown file editor/viewer.
 *
 * Opens as a right-side drawer when a .md file is clicked in FilesTab.
 *
 * Features:
 *   - Raw textarea editor (Edit mode)
 *   - Rendered Markdown preview (Preview mode)
 *   - Edit / Preview toggle buttons
 *   - Save button: PUT /api/teams/{id}/files/{name}/content
 *   - Unsaved-changes indicator (● dot on title)
 *   - Toast notification on save success/failure
 *   - Close via X button or backdrop click
 *
 * Uses `marked` (already in project deps) + `DOMPurify` for safe HTML.
 *
 * Acceptance criteria:
 *   ✅ Opens editor on .md file click
 *   ✅ Markdown source editor
 *   ✅ Preview mode (rendered Markdown)
 *   ✅ Edit/Preview toggle
 *   ✅ Save calls backend
 *   ✅ Save success Toast
 */
import { useEffect, useRef, useState } from 'react'
import { X, Eye, Edit2, Save } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'

interface Props {
  teamId: string
  filename: string
  onClose: () => void
}

export default function MDEditorDrawer({ teamId, filename, onClose }: Props) {
  const { lang } = useLang()
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)

  const isDirty = content !== original

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // Load file content on mount
  useEffect(() => {
    setLoading(true)
    api.getFileContent(teamId, filename)
      .then(res => { setContent(res.content); setOriginal(res.content) })
      .catch(() => { setContent(''); setOriginal('') })
      .finally(() => setLoading(false))
  }, [teamId, filename])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFileContent(teamId, filename, content)
      setOriginal(content)
      showToast(lang === 'zh' ? '✅ 已保存' : '✅ Saved')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : (lang === 'zh' ? '保存失败' : 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const previewHtml = DOMPurify.sanitize(
    marked.parse(content, { async: false }) as string
  )

  return (
    <>
      {/* Backdrop */}
      <div ref={backdropRef} onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 801, width: 'min(720px, 92vw)', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
          {/* File name + dirty indicator */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📝 {filename}
              {isDirty && <span style={{ color: 'var(--warning)', fontSize: 16, lineHeight: 1 }} title={lang === 'zh' ? '有未保存的更改' : 'Unsaved changes'}>●</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Markdown</div>
          </div>

          {/* Edit / Preview toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setMode('edit')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500, background: mode === 'edit' ? 'var(--accent)' : 'transparent', color: mode === 'edit' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Edit2 size={11} />
              {lang === 'zh' ? '编辑' : 'Edit'}
            </button>
            <button onClick={() => setMode('preview')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500, background: mode === 'preview' ? 'var(--accent)' : 'transparent', color: mode === 'preview' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Eye size={11} />
              {lang === 'zh' ? '预览' : 'Preview'}
            </button>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving || !isDirty}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: isDirty ? 'var(--accent)' : 'var(--bg-card)', color: isDirty ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: saving || !isDirty ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: saving ? 0.6 : 1 }}>
            <Save size={12} />
            {saving ? (lang === 'zh' ? '保存中…' : 'Saving…') : (lang === 'zh' ? '保存' : 'Save')}
          </button>

          {/* Close */}
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-secondary)', transition: 'color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Editor / Preview area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {lang === 'zh' ? '加载中…' : 'Loading…'}
            </div>
          ) : mode === 'edit' ? (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              spellCheck={false}
              style={{ flex: 1, width: '100%', background: 'var(--bg-base)', border: 'none', outline: 'none', padding: '20px', fontFamily: '"SF Mono","Fira Code",monospace', fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', resize: 'none', tabSize: 2 }} />
          ) : (
            <div
              className="markdown-body"
              style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg-base)', fontSize: 14, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: previewHtml || `<p style="color:var(--text-muted)">${lang === 'zh' ? '空文件' : 'Empty file'}</p>` }}
            />
          )}
        </div>

        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 18px', borderTop: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <span>{lang === 'zh' ? `${content.split('\n').length} 行` : `${content.split('\n').length} lines`}</span>
          <span>{lang === 'zh' ? `${content.length} 字符` : `${content.length} chars`}</span>
          {isDirty && <span style={{ color: 'var(--warning)' }}>● {lang === 'zh' ? '已修改' : 'Modified'}</span>}
          {toast && <span style={{ marginLeft: 'auto', color: toast.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{toast}</span>}
        </div>
      </div>

      {/* Markdown styles (scoped to preview) */}
      <style>{`
        .markdown-body h1 { font-size: 22px; font-weight: 700; margin: 0 0 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-default); padding-bottom: 8px; }
        .markdown-body h2 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; color: var(--text-primary); }
        .markdown-body h3 { font-size: 15px; font-weight: 600; margin: 16px 0 8px; color: var(--text-secondary); }
        .markdown-body p  { margin: 0 0 12px; color: var(--text-secondary); }
        .markdown-body ul,.markdown-body ol { margin: 0 0 12px; padding-left: 22px; color: var(--text-secondary); }
        .markdown-body li { margin-bottom: 4px; }
        .markdown-body code { font-family: monospace; font-size: 12px; background: var(--bg-card); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
        .markdown-body pre  { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 8px; padding: 14px; margin: 0 0 12px; overflow-x: auto; }
        .markdown-body pre code { background: none; padding: 0; color: var(--text-primary); }
        .markdown-body strong { font-weight: 600; color: var(--text-primary); }
        .markdown-body blockquote { border-left: 3px solid var(--accent); margin: 0 0 12px; padding: 4px 14px; color: var(--text-secondary); background: rgba(88,166,255,.05); border-radius: 0 6px 6px 0; }
        .markdown-body hr { border: none; border-top: 1px solid var(--border-default); margin: 16px 0; }
        .markdown-body a { color: var(--accent); text-decoration: underline; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
        .markdown-body th,.markdown-body td { border: 1px solid var(--border-default); padding: 6px 10px; font-size: 13px; }
        .markdown-body th { background: var(--bg-card); font-weight: 600; color: var(--text-primary); }
      `}</style>
    </>
  )
}
