'use client'
/**
 * FilesTab — M3-E1 file management panel.
 *
 * Sections:
 *   - 共享区 (uploads): files uploaded to /api/teams/{id}/files
 *   - 产物区 (artifacts): agent workspace files from designs/, docs/
 *
 * Features:
 *   - List with icon, name, size, date, download link
 *   - Sort by name / size / date
 *   - Upload via click or drag-and-drop
 *   - Delete with confirmation
 *   - Loading skeleton + empty state
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Download, File, FileText, FileImage, FileCode, FilePlus, MoreHorizontal, PenLine, Copy, Share2, X, Eye, ChevronRight, ChevronDown } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import MDEditorDrawer from './MDEditorDrawer'

interface TeamFile {
  name: string
  size: number
  modified_at: string
  mime_type: string
}

type SortKey = 'name' | 'size' | 'date'

type ArtifactFile = { name: string; path: string; size: number; modified_at: string; mime_type: string }
type ArtifactFolder = { folder: string; files: ArtifactFile[] }
type AgentArtifacts = { agent_id: string; agent_name: string; folders: ArtifactFolder[] }

const ICON_MAP: Record<string, React.ElementType> = {
  'image/': FileImage,
  'text/':  FileText,
  'application/json': FileCode,
  'application/pdf':  FileText,
}

function fileIcon(mimeType: string): React.ElementType {
  for (const [prefix, Icon] of Object.entries(ICON_MAP)) {
    if (mimeType.startsWith(prefix)) return Icon
  }
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function sortFiles(files: TeamFile[], key: SortKey): TeamFile[] {
  return [...files].sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name)
    if (key === 'size') return b.size - a.size
    return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-card)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-card)', width: '40%', marginBottom: 6 }} />
        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-card)', width: '25%' }} />
      </div>
    </div>
  )
}

interface FileSectionProps {
  title: string
  icon: string
  files: TeamFile[]
  loading: boolean
  sortKey: SortKey
  onSortChange: (k: SortKey) => void
  emptyText: string
  onDelete?: (name: string) => void
  downloadUrl?: (name: string) => string
  onEdit?: (name: string) => void
  onRename?: (name: string) => void
  onCopy?: (name: string) => void
  uploadArea?: React.ReactNode
}

function FileSection({ title, icon, files, loading, sortKey, onSortChange, emptyText, onDelete, downloadUrl, onEdit, onRename, onCopy, uploadArea }: FileSectionProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const { lang } = useLang()
  const sorted = sortFiles(files, sortKey)

  const SORT_LABELS: { key: SortKey; zh: string; en: string }[] = [
    { key: 'name', zh: '名称', en: 'Name' },
    { key: 'size', zh: '大小', en: 'Size' },
    { key: 'date', zh: '日期', en: 'Date' },
  ]

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        {/* Sort controls */}
        <div style={{ display: 'flex', gap: 4 }}>
          {SORT_LABELS.map(s => (
            <button key={s.key} onClick={() => onSortChange(s.key)}
              style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', borderColor: sortKey === s.key ? 'var(--accent)' : 'var(--border-default)', color: sortKey === s.key ? 'var(--accent)' : 'var(--text-secondary)', background: sortKey === s.key ? 'rgba(88,166,255,0.1)' : 'transparent' }}>
              {lang === 'zh' ? s.zh : s.en}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
          {loading ? '…' : `${files.length} ${lang === 'zh' ? '个文件' : 'files'}`}
        </span>
      </div>

      {/* Upload area */}
      {uploadArea}

      {/* File list */}
      {loading ? (
        <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
      ) : sorted.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          {emptyText}
        </div>
      ) : (
        sorted.map((file, idx) => {
          const Icon = fileIcon(file.mime_type)
          return (
            <div key={file.name}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: idx < sorted.length - 1 ? '1px solid var(--border-default)' : 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              {/* File icon */}
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(88,166,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: 'var(--accent)' }} />
              </div>
              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatSize(file.size)} · {formatDate(file.modified_at, lang)}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {/* Edit button for .md files */}
                {onEdit && file.name.toLowerCase().endsWith('.md') && (
                  <button onClick={() => onEdit(file.name)}
                    title="Edit Markdown"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <FileCode size={14} />
                  </button>
                )}
                {downloadUrl && (
                  <a href={downloadUrl(file.name)} download={file.name}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-secondary)', transition: 'all 0.15s', textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <Download size={14} />
                  </a>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(file.name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,81,73,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <Trash2 size={14} />
                  </button>
                )}
                {/* More actions menu */}
                {(onRename || onCopy) && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === file.name ? null : file.name) }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: menuOpen === file.name ? 'var(--bg-card)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                      onMouseEnter={e => { if (menuOpen !== file.name) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                      onMouseLeave={e => { if (menuOpen !== file.name) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <MoreHorizontal size={14} />
                    </button>
                    {menuOpen === file.name && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(null)} />
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, zIndex: 10, minWidth: 140, boxShadow: '0 4px 14px rgba(0,0,0,.25)', overflow: 'hidden' }}>
                          {onRename && (
                            <button onClick={() => { onRename(file.name); setMenuOpen(null) }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                              <PenLine size={13} /> Rename
                            </button>
                          )}
                          {onCopy && (
                            <button onClick={() => { onCopy(file.name); setMenuOpen(null) }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                              <Copy size={13} /> Copy
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Artifact Preview Drawer ───────────────────────────────────────────────────

function ArtifactPreviewDrawer({ teamId, agentId, agentName, filePath, fileName, mimeType, onClose }: {
  teamId: string; agentId: string; agentName: string; filePath: string; fileName: string; mimeType: string; onClose: () => void
}) {
  const { lang } = useLang()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fileUrl = api.getArtifactFileUrl(teamId, agentId, filePath)
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf')
  const isText = mimeType.startsWith('text/') || fileName.match(/\.(md|txt|json|js|ts|tsx|jsx|py|go|java|html|css|yml|yaml|toml|sh|bash|sql|xml|csv|log|cfg|ini|env|dockerfile)$/i)

  useEffect(() => {
    if (isImage || isPdf) { setLoading(false); return }
    if (!isText) { setLoading(false); return }
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(); return r.text() })
      .then(t => { setContent(t); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [fileUrl, isImage, isPdf, isText])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const isMarkdown = fileName.endsWith('.md')
  const renderedHtml = isMarkdown ? DOMPurify.sanitize(marked.parse(content, { async: false }) as string) : ''

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 801, width: 'min(780px, 92vw)', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
          <Eye size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{agentName} · {mimeType}</div>
          </div>
          <a href={fileUrl} download={fileName}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}>
            <Download size={12} />
            {lang === 'zh' ? '下载' : 'Download'}
          </a>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-secondary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
              {lang === 'zh' ? '加载中…' : 'Loading…'}
            </div>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--danger)', fontSize: 13 }}>
              {lang === 'zh' ? '加载失败' : 'Failed to load file'}
            </div>
          ) : isImage ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100%' }}>
              <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,.2)' }} />
            </div>
          ) : isPdf ? (
            <iframe src={fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={fileName} />
          ) : isText ? (
            isMarkdown ? (
              <div className="markdown-body" style={{ padding: '20px 24px', fontSize: 14, lineHeight: 1.8 }}
                dangerouslySetInnerHTML={{ __html: renderedHtml || `<p style="color:var(--text-muted)">${lang === 'zh' ? '空文件' : 'Empty file'}</p>` }} />
            ) : (
              <pre style={{ padding: '20px 24px', fontFamily: '"SF Mono","Fira Code",monospace', fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{content}</pre>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <File size={40} />
              <div style={{ fontSize: 13 }}>{lang === 'zh' ? '无法预览此文件类型' : 'Preview not available for this file type'}</div>
              <a href={fileUrl} download={fileName}
                style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                {lang === 'zh' ? '下载文件' : 'Download File'}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Reuse markdown styles from MDEditorDrawer */}
      {isMarkdown && <style>{`
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
      `}</style>}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilesTab({ teamId }: { teamId: string }) {
  const { lang } = useLang()
  const [files, setFiles] = useState<TeamFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mdFile, setMdFile] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [copyTarget, setCopyTarget] = useState<string | null>(null)
  const [copyValue, setCopyValue] = useState('')
  const [opSaving, setOpSaving] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Artifacts zone state
  const [artifacts, setArtifacts] = useState<AgentArtifacts[]>([])
  const [artifactsLoading, setArtifactsLoading] = useState(true)
  const [artifactsError, setArtifactsError] = useState(false)
  const [artifactDeleteTarget, setArtifactDeleteTarget] = useState<{ agentId: string; path: string; name: string } | null>(null)
  const [previewTarget, setPreviewTarget] = useState<{ agentId: string; agentName: string; path: string; name: string; mimeType: string } | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const openRename = (name: string) => { setRenameTarget(name); setRenameValue(name) }
  const openCopy   = (name: string) => { setCopyTarget(name);   setCopyValue(`copy of ${name}`) }

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    setOpSaving(true)
    try {
      await api.renameTeamFile(teamId, renameTarget, renameValue.trim())
      await load()
      setRenameTarget(null)
      showToast(lang === 'zh' ? '✅ 已重命名' : '✅ Renamed')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : (lang === 'zh' ? '重命名失败' : 'Rename failed'))
    } finally { setOpSaving(false) }
  }

  const handleCopy = async () => {
    if (!copyTarget || !copyValue.trim()) return
    setOpSaving(true)
    try {
      await api.copyTeamFile(teamId, copyTarget, copyValue.trim())
      await load()
      setCopyTarget(null)
      showToast(lang === 'zh' ? '✅ 已复制' : '✅ Copied')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : (lang === 'zh' ? '复制失败' : 'Copy failed'))
    } finally { setOpSaving(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listTeamFiles(teamId)
      setFiles(data.files)
    } catch (e) {
      setError(lang === 'zh' ? '加载失败' : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [teamId, lang])

  const loadArtifacts = useCallback(async () => {
    setArtifactsLoading(true)
    setArtifactsError(false)
    try {
      const data = await api.getTeamArtifacts(teamId)
      setArtifacts(data.agents)
    } catch {
      setArtifactsError(true)
    } finally {
      setArtifactsLoading(false)
    }
  }, [teamId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadArtifacts() }, [loadArtifacts])

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        await api.uploadTeamFile(teamId, file)
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (lang === 'zh' ? '上传失败' : 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (name: string) => {
    setDeleteTarget(null)
    setError(null)
    try {
      await api.deleteTeamFile(teamId, name)
      setFiles(prev => prev.filter(f => f.name !== name))
    } catch {
      setError(lang === 'zh' ? '删除失败' : 'Delete failed')
    }
  }

  const handleDeleteArtifact = async () => {
    if (!artifactDeleteTarget) return
    try {
      await api.deleteArtifactFile(teamId, artifactDeleteTarget.agentId, artifactDeleteTarget.path)
      setArtifactDeleteTarget(null)
      showToast(lang === 'zh' ? '✅ 已删除' : '✅ Deleted')
      await loadArtifacts()
    } catch {
      showToast(lang === 'zh' ? '删除失败' : 'Delete failed')
      setArtifactDeleteTarget(null)
    }
  }

  const downloadUrl = (name: string) => {
    const BASE = (process.env.NEXT_PUBLIC_SSE_BASE?.trim() || '/api')
    return `${BASE}/teams/${teamId}/files/${encodeURIComponent(name)}`
  }

  // ── Upload area ────────────────────────────────────────────────────────────
  const uploadArea = (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      style={{ margin: '12px 16px', padding: '16px', borderRadius: 8, border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-default)'}`, background: dragOver ? 'rgba(88,166,255,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.15s', color: dragOver ? 'var(--accent)' : 'var(--text-secondary)' }}>
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleUpload(e.target.files)} />
      {uploading ? (
        <>
          <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13 }}>{lang === 'zh' ? '上传中…' : 'Uploading…'}</span>
        </>
      ) : (
        <>
          <FilePlus size={18} />
          <span style={{ fontSize: 13 }}>
            {lang === 'zh' ? '点击上传或拖拽文件到此处（最大 20 MB）' : 'Click to upload or drag & drop files here (max 20 MB)'}
          </span>
        </>
      )}
    </div>
  )

  // ── Artifacts: read-only listing from designs/ and docs/ ──────────────────
  // Artifacts are files in the team's shared dirs (designs, docs).
  // For now we show them from the uploads list filtered by subdir prefix,
  // but the backend exposes them via the same endpoint.
  // The distinction is purely UI: uploads = user-managed, artifacts = agent-generated.
  // We keep them together in one list here (the backend doesn't differentiate yet).

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(248,81,73,0.1)', border: '1px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Shared files section */}
      <FileSection
        title={lang === 'zh' ? '上传区' : 'Upload Area'}
        icon="📁"
        files={files}
        loading={loading}
        sortKey={sortKey}
        onSortChange={setSortKey}
        emptyText={lang === 'zh' ? '暂无上传文件' : 'No uploaded files yet — drop files here'}
        onDelete={name => setDeleteTarget(name)}
        downloadUrl={downloadUrl}
        onEdit={name => setMdFile(name)}
        onRename={openRename}
        onCopy={openCopy}
        uploadArea={uploadArea}
      />

      {/* ── Artifacts Zone ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {lang === 'zh' ? '产物区' : 'Artifacts'}
          </span>
          <button onClick={loadArtifacts} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit', padding: '2px 8px' }}>
            {lang === 'zh' ? '刷新' : 'Refresh'}
          </button>
        </div>

        {artifactsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--bg-card)' }} />)}
          </div>
        ) : artifactsError ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--danger)', fontSize: 13, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8 }}>
            {lang === 'zh' ? '⚠️ 加载失败，请重试' : '⚠️ Failed to load, please retry'}
          </div>
        ) : artifacts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8 }}>
            {lang === 'zh' ? '各 Agent 暂无产物文件' : 'No artifact files from agents yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {artifacts.map(agent => (
              <div key={agent.agent_id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Agent header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#79c0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {agent.agent_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{agent.agent_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ({agent.folders.reduce((s, f) => s + f.files.length, 0)} {lang === 'zh' ? '个文件' : 'files'})
                  </span>
                </div>
                {/* Folders */}
                {agent.folders.map(folder => {
                  const folderKey = `${agent.agent_id}/${folder.folder || '_root'}`
                  const isExpanded = expandedFolders.has(folderKey)
                  const toggleFolder = () => setExpandedFolders(prev => {
                    const next = new Set(prev)
                    if (next.has(folderKey)) next.delete(folderKey)
                    else next.add(folderKey)
                    return next
                  })
                  return (
                  <div key={folder.folder || '_root'}>
                    {folder.folder ? (
                      <div onClick={toggleFolder} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(88,166,255,0.04)', borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase', letterSpacing: '.5px', cursor: 'pointer', userSelect: 'none' }}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        📁 {folder.folder}/ <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({folder.files.length})</span>
                      </div>
                    ) : null}
                    {(!folder.folder || isExpanded) && folder.files.map(file => (
                      <div key={file.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border-default)', fontSize: 12 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 14, flexShrink: 0 }}>
                          {file.mime_type.startsWith('image/') ? '🖼️' : file.mime_type.includes('pdf') ? '📄' : file.name.endsWith('.md') ? '📝' : file.mime_type.startsWith('text/') || file.name.match(/\.(ts|tsx|js|py|go|java)$/) ? '💻' : '📎'}
                        </span>
                        <span
                          onClick={() => setPreviewTarget({ agentId: agent.agent_id, agentName: agent.agent_name, path: file.path, name: file.name, mimeType: file.mime_type })}
                          style={{ flex: 1, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'none' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
                          title={lang === 'zh' ? '点击预览' : 'Click to preview'}
                        >{file.name}</span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatSize(file.size)}</span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(file.modified_at, lang)}</span>
                        <a href={api.getArtifactFileUrl(teamId, agent.agent_id, file.path)} download={file.name}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, color: 'var(--text-muted)', flexShrink: 0, textDecoration: 'none', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <Download size={13} />
                        </a>
                        <button onClick={async () => {
                            try {
                              await api.copyArtifactToShared(teamId, agent.agent_id, file.path)
                              load()
                            } catch { /* ignore */ }
                          }}
                          title={lang === 'zh' ? '复制到上传区' : 'Copy to Upload Area'}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <Share2 size={13} />
                        </button>
                        <button onClick={() => setArtifactDeleteTarget({ agentId: agent.agent_id, path: file.path, name: file.name })}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,81,73,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artifact delete confirmation */}
      {artifactDeleteTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setArtifactDeleteTarget(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 24, zIndex: 101, width: 320 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {lang === 'zh' ? '删除产物文件' : 'Delete Artifact'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {lang === 'zh'
                ? `确认删除「${artifactDeleteTarget.name}」？此操作不可撤销。`
                : `Delete "${artifactDeleteTarget.name}"? This cannot be undone.`}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setArtifactDeleteTarget(null)}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button onClick={handleDeleteArtifact}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '删除' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setDeleteTarget(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 24, zIndex: 101, width: 320 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {lang === 'zh' ? '删除文件' : 'Delete File'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {lang === 'zh'
                ? `确认删除「${deleteTarget}」？此操作不可撤销。`
                : `Delete "${deleteTarget}"? This action cannot be undone.`}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(deleteTarget)}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '删除' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* CSS for spin animation */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Rename modal */}
      {renameTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100 }} onClick={() => setRenameTarget(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 24, zIndex: 101, width: 340 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              {lang === 'zh' ? '重命名文件' : 'Rename file'}
            </div>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 11px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' as const }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameTarget(null)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button onClick={handleRename} disabled={opSaving || !renameValue.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: opSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: opSaving || !renameValue.trim() ? 0.5 : 1 }}>
                {opSaving ? '…' : (lang === 'zh' ? '保存' : 'Save')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Copy modal */}
      {copyTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100 }} onClick={() => setCopyTarget(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 24, zIndex: 101, width: 340 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {lang === 'zh' ? '复制文件' : 'Copy file'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {lang === 'zh' ? `从 "${copyTarget}" 复制为:` : `Copy "${copyTarget}" as:`}
            </div>
            <input type="text" value={copyValue} onChange={e => setCopyValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCopy()}
              autoFocus
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 11px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' as const }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCopyTarget(null)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button onClick={handleCopy} disabled={opSaving || !copyValue.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: opSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: opSaving || !copyValue.trim() ? 0.5 : 1 }}>
                {opSaving ? '…' : (lang === 'zh' ? '复制' : 'Copy')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: toast.startsWith('✅') ? 'var(--success)' : 'var(--danger)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 200 }}>
          {toast}
        </div>
      )}

      {/* Markdown editor drawer — opens when a .md file is clicked */}
      {mdFile && (
        <MDEditorDrawer
          teamId={teamId}
          filename={mdFile}
          onClose={() => setMdFile(null)}
        />
      )}

      {/* Artifact preview drawer */}
      {previewTarget && (
        <ArtifactPreviewDrawer
          teamId={teamId}
          agentId={previewTarget.agentId}
          agentName={previewTarget.agentName}
          filePath={previewTarget.path}
          fileName={previewTarget.name}
          mimeType={previewTarget.mimeType}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  )
}
