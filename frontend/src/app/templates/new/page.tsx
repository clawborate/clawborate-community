'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MarkdownEditor from '@/components/templates/MarkdownEditor'
import { useAuth } from '@/hooks/useAuth'
import { api, proactiveRefresh } from '@/lib/api'

type TemplateType = 'agent' | 'team'

export default function NewTemplatePage() {
  const router = useRouter()
  const { user } = useAuth()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType>('agent')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  const NAME_MAX = 60
  const DESC_MAX = 200
  const TAGS_MAX = 5
  const SCREENSHOT_MAX = 5 * 1024 * 1024 // 5MB

  // Validate on submit
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = '模板名称不能为空'
    else if (name.length > NAME_MAX) errs.name = `名称最多 ${NAME_MAX} 个字符`
    if (!description.trim()) errs.description = '描述不能为空'
    else if (description.length > DESC_MAX) errs.description = `描述最多 ${DESC_MAX} 个字符`
    if (!content.trim()) errs.content = '内容不能为空'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [name, description, content])

  // Tag management
  const addTag = useCallback(() => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (tags.length >= TAGS_MAX) {
      showToast(`最多添加 ${TAGS_MAX} 个标签`)
      return
    }
    if (tags.includes(trimmed)) {
      showToast('标签已存在')
      return
    }
    setTags(prev => [...prev, trimmed])
    setTagInput('')
  }, [tagInput, tags, showToast])

  const removeTag = useCallback((index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }, [addTag])

  // File upload
  const handleFileChange = useCallback((file: File | null) => {
    if (!file) { setScreenshot(null); return }
    const allowed = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowed.includes(file.type)) {
      showToast('仅支持 PNG/JPG 格式')
      return
    }
    if (file.size > SCREENSHOT_MAX) {
      showToast('文件大小不能超过 5MB')
      return
    }
    setScreenshot(file)
  }, [showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFileChange(file || null)
  }, [handleFileChange])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    handleFileChange(file)
  }, [handleFileChange])

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!user) {
      showToast('请先登录')
      return
    }

    setSubmitting(true)
    try {
      // Check pending count
      const checkRes = await fetch('/api/templates?status=pending&contributor=' + encodeURIComponent(user.id))
      if (checkRes.ok) {
        const data = await checkRes.json()
        if (Array.isArray(data) && data.length >= 3) {
          showToast('您已有 3 个待审核模板，请稍后再提交')
          setSubmitting(false)
          return
        }
      }

      await proactiveRefresh()
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          template_type: templateType,
          content: content.trim(),
          tags: tags.length > 0 ? tags : undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Request failed')
      }

      showToast('Template submitted for review')
      router.push('/templates')
    } catch {
      showToast('提交失败，请检查网络后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [router])

  const isValid = name.trim().length > 0 && description.trim().length > 0 && content.trim().length > 0

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '8px 16px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 8, fontSize: 13,
          color: toast.startsWith('Template') ? 'var(--color-success)' : 'var(--color-danger)',
          boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 200,
        }}>
          {toast}
        </div>
      )}

      {/* Page content */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Submit a Template
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Share your template with the community. Fill in the details below and submit for review.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Template Name */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">
              Template Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })) }}
              maxLength={NAME_MAX}
              placeholder="e.g. Customer Support Agent Team"
              className="input"
              style={{ borderColor: errors.name ? 'var(--color-danger)' : undefined }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.name && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.name}</span>}
              <span style={{ fontSize: 12, color: name.length > 0 ? 'var(--text-secondary)' : 'var(--text-disabled)', marginLeft: 'auto' }}>
                {name.length}/{NAME_MAX}
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">
              Description <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); if (errors.description) setErrors(prev => ({ ...prev, description: '' })) }}
              maxLength={DESC_MAX}
              placeholder="Brief description of what this template does..."
              className="textarea"
              style={{ minHeight: 80, fontFamily: 'inherit', fontSize: 14, borderColor: errors.description ? 'var(--color-danger)' : undefined }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.description && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.description}</span>}
              <span style={{ fontSize: 12, color: description.length > 0 ? 'var(--text-secondary)' : 'var(--text-disabled)', marginLeft: 'auto' }}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
          </div>

          {/* Type Segmented Control */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">
              Type <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {(['agent', 'team'] as TemplateType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTemplateType(type)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 500,
                    background: templateType === type ? 'var(--accent)' : 'transparent',
                    color: templateType === type ? '#fff' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {type === 'agent' ? 'Agent' : 'Team'}
                </button>
              ))}
            </div>
          </div>

          {/* Markdown Content */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">
              Markdown Content <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            {errors.content && (
              <span style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 6, display: 'block' }}>
                {errors.content}
              </span>
            )}
            <MarkdownEditor value={content} onChange={v => { setContent(v); if (errors.content) setErrors(prev => ({ ...prev, content: '' })) }} />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">Tags <span style={{ color: 'var(--text-disabled)' }}>(optional, max {TAGS_MAX})</span></label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  fontSize: 13, color: 'var(--text-primary)',
                }}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter"
                className="input"
                style={{ flex: 1, fontSize: 13 }}
              />
              <button
                type="button"
                onClick={addTag}
                disabled={tags.length >= TAGS_MAX || !tagInput.trim()}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '8px 12px', whiteSpace: 'nowrap' }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Screenshot Upload */}
          <div style={{ marginBottom: 28 }}>
            <label className="label">Screenshot <span style={{ color: 'var(--text-disabled)' }}>(optional, PNG/JPG, max 5MB)</span></label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : errors.screenshot ? 'var(--color-danger)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-lg)', padding: '24px',
                textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(88,166,255,0.05)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              {screenshot ? (
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  📎 {screenshot.name}{' '}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    ({(screenshot.size / 1024).toFixed(0)}KB)
                  </span>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent)' }}>Click to change</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Drag & drop an image here, or <span style={{ color: 'var(--accent)' }}>browse</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="btn-primary"
              style={{ opacity: submitting || !isValid ? 0.5 : 1 }}
            >
              {submitting ? 'Submitting...' : 'Submit for Review ▶'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
