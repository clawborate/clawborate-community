'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'

interface Props {
  teamId: string
  agentId: string
  onToast: (msg: string) => void
}

type StatusPill = 'unknown' | 'configured' | 'not_set' | 'auth_failed'

export default function GitCredentialsTab({ teamId, agentId, onToast }: Props) {
  const { lang } = useLang()
  const [loading, setLoading] = useState(true)
  const [repoUrl, setRepoUrl] = useState('')
  const [username, setUsername] = useState('git')
  const [pat, setPat] = useState('')
  const [maskedPat, setMaskedPat] = useState('')
  const [isSet, setIsSet] = useState(false)
  const [editingPat, setEditingPat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [statusPill, setStatusPill] = useState<StatusPill>('unknown')
  const [testOutput, setTestOutput] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)',
    borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getAgentGitCredentials(teamId, agentId)
      setRepoUrl(res.repo_url || '')
      setUsername(res.username || 'git')
      setMaskedPat(res.pat_masked || '')
      setIsSet(res.is_set)
      setStatusPill(res.is_set ? 'configured' : 'not_set')
      setEditingPat(false)
      setPat('')
      setTestOutput('')
    } catch {
      // leave defaults
    } finally {
      setLoading(false)
    }
  }, [teamId, agentId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    const patValue = (editingPat || !isSet) ? pat.trim() : ''
    if (!patValue) {
      onToast(lang === 'zh' ? '请输入 PAT' : 'PAT is required')
      return
    }
    setSaving(true)
    try {
      await api.updateAgentGitCredentials(teamId, agentId, {
        repo_url: repoUrl.trim() || undefined,
        username: username.trim() || 'git',
        pat: patValue,
      })
      onToast(lang === 'zh' ? '✅ 已保存' : '✅ Saved')
      await load()
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReplace = () => {
    setEditingPat(true)
    setPat('')
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await api.deleteAgentGitCredentials(teamId, agentId)
      onToast(lang === 'zh' ? '已移除' : 'Removed')
      setRepoUrl('')
      setUsername('git')
      setMaskedPat('')
      setPat('')
      setIsSet(false)
      setStatusPill('not_set')
      setConfirmRemove(false)
      setEditingPat(false)
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestOutput('')
    try {
      const res = await api.testAgentGitCredentials(teamId, agentId)
      if (res.status === 'ok') {
        setStatusPill('configured')
        onToast(lang === 'zh' ? '✅ 验证成功' : '✅ Verified')
      } else {
        setStatusPill('auth_failed')
        setTestOutput(res.output || '')
        onToast(lang === 'zh' ? '验证失败' : 'Auth failed')
      }
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const pillColor: Record<StatusPill, { bg: string; fg: string; label: string }> = {
    unknown:     { bg: 'rgba(139,148,158,.12)', fg: 'var(--text-muted)',  label: lang === 'zh' ? '未知' : 'Unknown' },
    configured:  { bg: 'rgba(63,185,80,.12)',  fg: 'var(--success)',     label: lang === 'zh' ? '已配置' : 'Configured' },
    not_set:     { bg: 'rgba(139,148,158,.12)', fg: 'var(--text-muted)',  label: lang === 'zh' ? '未设置' : 'Not set' },
    auth_failed: { bg: 'rgba(248,81,73,.12)',   fg: 'var(--danger)',      label: lang === 'zh' ? '认证失败' : 'Auth failed' },
  }
  const pill = pillColor[statusPill]
  const canEditPat = !isSet || editingPat

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 40, background: 'var(--bg-card)', borderRadius: 6 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          background: pill.bg, color: pill.fg,
        }}>{pill.label}</span>
        {isSet && (
          <button onClick={handleTest} disabled={testing}
            style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, color: 'var(--text-secondary)', cursor: testing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {testing ? '…' : (lang === 'zh' ? '测试连接' : 'Test')}
          </button>
        )}
      </div>

      {testOutput && (
        <pre style={{
          margin: '0 0 16px', padding: 10, fontSize: 11, background: '#0D1117', color: 'var(--danger)',
          borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto',
        }}>{testOutput}</pre>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Repo URL */}
        <div>
          <label style={labelStyle}>{lang === 'zh' ? '仓库 URL' : 'Repo URL'}</label>
          <input type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo.git"
            style={inputStyle}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
        </div>

        {/* Username */}
        <div>
          <label style={labelStyle}>
            {lang === 'zh' ? '用户名' : 'Username'}
            <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
              ({lang === 'zh' ? 'GitHub PAT 默认 "git"' : 'default "git" for GitHub PAT'})
            </span>
          </label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="git"
            style={inputStyle}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
        </div>

        {/* PAT */}
        <div>
          <label style={labelStyle}>
            PAT
            {isSet && !editingPat && (
              <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>
                ({lang === 'zh' ? '已设置' : 'set'}: {maskedPat})
              </span>
            )}
          </label>
          {canEditPat ? (
            <input type="password" value={pat} onChange={e => setPat(e.target.value)}
              placeholder={isSet
                ? (lang === 'zh' ? '输入新 PAT 以替换' : 'Enter new PAT to replace')
                : (lang === 'zh' ? '输入 PAT' : 'Enter PAT')}
              style={inputStyle} autoFocus={editingPat}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          ) : (
            <button onClick={handleReplace}
              style={{ padding: '6px 14px', fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {lang === 'zh' ? '替换 PAT' : 'Replace PAT'}
            </button>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4, flexWrap: 'wrap' }}>
          <button onClick={handleSave} disabled={saving || (!canEditPat)}
            style={{
              padding: '8px 20px',
              background: (saving || !canEditPat) ? 'var(--bg-card)' : 'var(--accent)',
              color: (saving || !canEditPat) ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: (saving || !canEditPat) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            {saving ? (lang === 'zh' ? '保存中…' : 'Saving…') : (lang === 'zh' ? '保存' : 'Save')}
          </button>
          {isSet && !confirmRemove && (
            <button onClick={() => setConfirmRemove(true)}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 6, fontSize: 13, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
              {lang === 'zh' ? '移除' : 'Remove'}
            </button>
          )}
          {isSet && confirmRemove && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {lang === 'zh' ? '确认?' : 'Confirm?'}
              </span>
              <button onClick={handleRemove} disabled={removing}
                style={{ padding: '6px 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: removing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {removing ? '…' : (lang === 'zh' ? '移除' : 'Remove')}
              </button>
              <button onClick={() => setConfirmRemove(false)} disabled={removing}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-disabled)', lineHeight: 1.5 }}>
          {lang === 'zh'
            ? '提示：使用 GitHub fine-grained PAT，仅授权所需仓库。PAT 写入容器内 /run/secrets/git-pat（mode 0400），不会出现在环境变量或日志中。'
            : 'Tip: use a GitHub fine-grained PAT scoped only to the repos this agent needs. The PAT is written to /run/secrets/git-pat (mode 0400) inside the container — never to env vars or logs.'}
        </div>
      </div>
    </div>
  )
}
