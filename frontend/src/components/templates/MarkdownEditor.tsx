'use client'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

type ToolbarAction = 'bold' | 'italic' | 'inlineCode' | 'codeBlock' | 'link' | 'attachment'

interface ActionConfig {
  key: ToolbarAction
  label: string
  icon: string
  prefix: string
  suffix: string
  placeholder?: string
  insertMode?: 'line' | 'inline'
}

const ACTIONS: ActionConfig[] = [
  { key: 'bold', label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { key: 'italic', label: 'Italic', icon: 'I', prefix: '*', suffix: '*' },
  { key: 'inlineCode', label: 'Inline code', icon: '`', prefix: '`', suffix: '`' },
  { key: 'link', label: 'Link', icon: '🔗', prefix: '[', suffix: '](url)', placeholder: 'text' },
  { key: 'codeBlock', label: 'Code block', icon: '</>', prefix: '```\n', suffix: '\n```', insertMode: 'line' },
  { key: 'attachment', label: 'Attachment', icon: '📎', prefix: '[attachment](', suffix: 'url)' },
]

function wrapSelection(textarea: HTMLTextAreaElement, prefix: string, suffix: string, placeholder?: string): string {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.substring(selectionStart, selectionEnd)
  const replacement = selected
    ? prefix + selected + suffix
    : prefix + (placeholder || 'text') + suffix
  const newValue = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd)
  return newValue
}

export default function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const handleToolbarClick = useCallback((action: ActionConfig) => {
    const ta = textareaRef.current
    if (!ta) return
    const newValue = wrapSelection(ta, action.prefix, action.suffix, action.placeholder)
    onChange(newValue)
    // Restore focus after state update
    requestAnimationFrame(() => { ta.focus() })
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const { selectionStart, selectionEnd, value } = ta
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
      onChange(newValue)
      // Move cursor after the inserted spaces
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = selectionStart + 2
      })
    }
  }, [onChange])

  // Render markdown preview
  const previewHtml = useMemo(() => {
    if (!value.trim()) return ''
    return DOMPurify.sanitize(marked.parse(value, { async: false }) as string)
  }, [value])

  // Track window resize for responsive breakpoint
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
      {/* Mobile tab switcher */}
      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
          <button
            onClick={() => setMobileTab('edit')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500,
              background: mobileTab === 'edit' ? 'var(--accent)' : 'transparent',
              color: mobileTab === 'edit' ? '#fff' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Edit
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500,
              background: mobileTab === 'preview' ? 'var(--accent)' : 'transparent',
              color: mobileTab === 'preview' ? '#fff' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Preview
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Editor panel */}
        <div style={{
          flex: 1, minWidth: 0,
          display: isMobile ? (mobileTab === 'edit' ? 'flex' : 'none') : 'flex',
          flexDirection: 'column',
          borderRight: isMobile ? 'none' : '1px solid var(--border-default)',
          minHeight: 320,
        }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 8px', borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-card)', flexShrink: 0,
          }}>
            {ACTIONS.map(action => (
              <button
                key={action.key}
                type="button"
                title={action.label}
                onClick={() => handleToolbarClick(action)}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: action.key === 'bold' || action.key === 'italic' ? 14 : 13,
                  fontFamily: action.key === 'bold' ? 'inherit' : action.key === 'italic' ? 'inherit' : '"SF Mono","Fira Code",monospace',
                  fontWeight: action.key === 'bold' ? 700 : action.key === 'italic' ? 400 : 'inherit',
                  fontStyle: action.key === 'italic' ? 'italic' : 'normal',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                }}
              >
                {action.icon}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="Write your template content in Markdown..."
            className="textarea"
            style={{
              flex: 1, minHeight: 280, fontFamily: '"SF Mono","Fira Code",monospace',
              fontSize: 13, lineHeight: 1.7, tabSize: 2,
              border: 'none', borderRadius: 0,
              resize: 'none',
            }}
          />
        </div>

        {/* Preview panel */}
        <div style={{
          flex: 1, minWidth: 0,
          display: isMobile ? (mobileTab === 'preview' ? 'block' : 'none') : 'block',
          minHeight: 320,
        }}>
          <div style={{
            padding: '8px 16px', borderBottom: '1px solid var(--border-default)',
            fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
            background: 'var(--bg-card)',
          }}>
            实时预览区
          </div>
          <div
            className="markdown-preview"
            style={{
              padding: '16px 20px', minHeight: 264, overflowY: 'auto',
              fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)',
              background: 'var(--bg-base)',
            }}
            dangerouslySetInnerHTML={{
              __html: previewHtml || `<p style="color:var(--text-disabled);font-style:italic">Nothing to preview yet...</p>`,
            }}
          />
        </div>
      </div>

      {/* Scoped preview styles */}
      <style>{`
        .markdown-preview h1 { font-size: 24px; font-weight: 700; margin: 0 0 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-default); padding-bottom: 8px; }
        .markdown-preview h2 { font-size: 20px; font-weight: 600; margin: 20px 0 10px; color: var(--text-primary); }
        .markdown-preview h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: var(--text-primary); }
        .markdown-preview h4 { font-size: 16px; font-weight: 600; margin: 14px 0 8px; color: var(--text-primary); }
        .markdown-preview h5 { font-size: 14px; font-weight: 600; margin: 12px 0 6px; color: var(--text-primary); }
        .markdown-preview h6 { font-size: 13px; font-weight: 600; margin: 10px 0 6px; color: var(--text-secondary); }
        .markdown-preview p { margin: 0 0 12px; color: var(--text-secondary); }
        .markdown-preview ul, .markdown-preview ol { margin: 0 0 12px; padding-left: 22px; color: var(--text-secondary); }
        .markdown-preview li { margin-bottom: 4px; }
        .markdown-preview code { font-family: "SF Mono","Fira Code",monospace; font-size: 12px; background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
        .markdown-preview pre { background: var(--bg-surface); border-radius: 4px; border-left: 3px solid var(--accent); padding: 14px 16px; margin: 0 0 12px; overflow-x: auto; }
        .markdown-preview pre code { background: none; padding: 0; color: var(--text-primary); font-size: 13px; }
        .markdown-preview strong { font-weight: 600; color: var(--text-primary); }
        .markdown-preview em { font-style: italic; }
        .markdown-preview blockquote { border-left: 3px solid var(--text-secondary); margin: 0 0 12px; padding: 4px 14px; color: var(--text-secondary); font-style: italic; }
        .markdown-preview hr { border: none; border-top: 1px solid var(--border-default); margin: 16px 0; }
        .markdown-preview a { color: var(--accent); text-decoration: underline; }
        .markdown-preview img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
        .markdown-preview table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
        .markdown-preview th, .markdown-preview td { border: 1px solid var(--border-default); padding: 8px 12px; font-size: 13px; }
        .markdown-preview th { background: var(--bg-card); font-weight: 600; color: var(--text-primary); }
        .markdown-preview tr:nth-child(even) td { background: var(--bg-surface); }
      `}</style>
    </div>
  )
}
