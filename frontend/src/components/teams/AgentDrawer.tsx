'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Bot } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'
import type { Agent, AgentFiles } from '@/types'

type Tab = 'overview' | 'identity' | 'soul' | 'memory' | 'console' | 'llm'

interface LogLine { timestamp: string; type: string; message: string }

interface Props {
  agent: Agent
  teamId: string
  onClose: () => void
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

/* ── LLM form constants ──────────────────────────────────────────────────── */

const LLM_PROVIDERS = [
  { id: 'openai',    label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'ollama',    label: 'Ollama (Local)' },
  { id: 'custom',    label: 'Custom / Other' },
]

const LLM_MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-5', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  ollama:    ['llama3', 'mistral', 'gemma2', 'phi3'],
  custom:    [],
}

const LLM_URL_REQUIRED = new Set(['ollama', 'custom'])

export default function AgentDrawer({ agent, teamId, onClose }: Props) {
  const { lang } = useLang()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [files, setFiles] = useState<AgentFiles>({ identity: '', soul: '', memory: '' })
  const [editedFiles, setEditedFiles] = useState<AgentFiles>({ identity: '', soul: '', memory: '' })
  const [filesError, setFilesError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [logs, setLogs] = useState<LogLine[]>([])
  const [liveConnected, setLiveConnected] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  // ── LLM tab state ──────────────────────────────────────────────────────
  const [llmProvider, setLlmProvider] = useState('openai')
  const [llmModel, setLlmModel] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmMaskedKey, setLlmMaskedKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmContextWindow, setLlmContextWindow] = useState('')
  const [llmMaxTokens, setLlmMaxTokens] = useState('')
  const [llmTimeoutSeconds, setLlmTimeoutSeconds] = useState('1800')
  const [llmIdleTimeoutSeconds, setLlmIdleTimeoutSeconds] = useState('300')
  const [llmThinkingMode, setLlmThinkingMode] = useState(false)
  const [llmSkipBootstrap, setLlmSkipBootstrap] = useState(false)
  const [llmCustomModel, setLlmCustomModel] = useState('')
  const [llmIsOverride, setLlmIsOverride] = useState(false)
  const [llmInheritsFrom, setLlmInheritsFrom] = useState('global')
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmResetting, setLlmResetting] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Load agent files
  useEffect(() => {
    api.getAgentFiles(teamId, agent.id)
      .then(f => { setFiles(f); setEditedFiles(f) })
      .catch(() => setFilesError(true))
  }, [teamId, agent.id])

  // Console SSE with auto-reconnect
  useEffect(() => {
    if (activeTab !== 'console') return
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function connect() {
      if (cancelled) return
      const sseBase = process.env.NEXT_PUBLIC_SSE_BASE?.trim() || ''
      const es = new EventSource(`${sseBase}/api/teams/${teamId}/agents/${agent.id}/logs/stream`)
      esRef.current = es
      setLiveConnected(true)
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as LogLine
          setLogs(prev => [...prev.slice(-200), data])
        } catch {}
      }
      es.onerror = () => {
        setLiveConnected(false)
        es.close()
        esRef.current = null
        if (!cancelled) retryTimer = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      setLiveConnected(false)
    }
  }, [activeTab, teamId, agent.id])

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [logs])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── LLM tab data loading ───────────────────────────────────────────────
  const loadLLMConfig = useCallback(async () => {
    setLlmLoading(true)
    try {
      const res = await api.getAgentLLMConfig(teamId, agent.id)
      const llm = res.llm ?? {}
      const prov = llm.provider ?? 'openai'
      setLlmProvider(prov)
      const models = LLM_MODELS[prov] ?? []
      if (models.length === 0) {
        setLlmModel('__custom__')
        setLlmCustomModel(llm.model ?? '')
      } else if (llm.model && !models.includes(llm.model)) {
        setLlmModel('__custom__')
        setLlmCustomModel(llm.model)
      } else {
        setLlmModel(llm.model ?? models[0] ?? '')
        setLlmCustomModel('')
      }
      setLlmMaskedKey(llm.api_key_masked ?? '')
      setLlmBaseUrl(llm.base_url ?? '')
      setLlmContextWindow(llm.context_window ? String(llm.context_window) : '')
      setLlmMaxTokens(llm.max_tokens ? String(llm.max_tokens) : '')
      setLlmTimeoutSeconds(String(llm.timeout_seconds ?? 1800))
      setLlmIdleTimeoutSeconds(String(llm.llm_idle_timeout_seconds ?? 300))
      setLlmThinkingMode(llm.thinking_mode ?? false)
      setLlmSkipBootstrap(llm.skip_bootstrap ?? false)
      setLlmIsOverride(res.is_override)
      setLlmInheritsFrom(res.inherits_from)
    } catch { /* leave defaults */ }
    finally { setLlmLoading(false) }
  }, [teamId, agent.id])

  useEffect(() => {
    if (activeTab === 'llm') loadLLMConfig()
  }, [activeTab, loadLLMConfig])

  const handleSaveFile = async (fileKey: keyof AgentFiles) => {
    setSaving(true)
    try {
      await api.updateAgentFiles(teamId, agent.id, { [fileKey]: editedFiles[fileKey] })
      setFiles(prev => ({ ...prev, [fileKey]: editedFiles[fileKey] }))
      showToast(lang === 'zh' ? '✅ 配置已保存' : '✅ Config saved')
    } catch {
      showToast(lang === 'zh' ? '保存失败' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── LLM handlers ──────────────────────────────────────────────────────
  const llmEffectiveModel = (!LLM_MODELS[llmProvider]?.length || llmModel === '__custom__') ? llmCustomModel : llmModel

  const handleLlmProviderChange = (p: string) => {
    setLlmProvider(p)
    const first = LLM_MODELS[p]?.[0] ?? ''
    setLlmModel(first)
    setLlmCustomModel('')
  }

  const handleLlmSave = async () => {
    if (!llmEffectiveModel.trim()) {
      showToast(lang === 'zh' ? '请输入模型名称' : 'Model name is required')
      return
    }
    const timeout = Number(llmTimeoutSeconds) || 1800
    const idleTimeout = Number(llmIdleTimeoutSeconds) || 300
    if (timeout < 10 || timeout > 3600) {
      showToast(lang === 'zh' ? '超时时间必须在 10-3600 秒之间' : 'Timeout must be between 10 and 3600 seconds')
      return
    }
    if (idleTimeout < 10 || idleTimeout > 3600) {
      showToast(lang === 'zh' ? '首字符超时必须在 10-3600 秒之间' : 'First-token timeout must be between 10 and 3600 seconds')
      return
    }
    setLlmSaving(true)
    try {
      const payload: Record<string, unknown> = {
        provider: llmProvider,
        model: llmEffectiveModel.trim(),
      }
      if (llmApiKey.trim()) payload.api_key = llmApiKey.trim()
      if (llmBaseUrl.trim()) payload.base_url = llmBaseUrl.trim()
      if (llmProvider === 'custom') {
        const ctxWin = Number(llmContextWindow)
        const maxTok = Number(llmMaxTokens)
        if (ctxWin) payload.context_window = ctxWin
        if (maxTok) payload.max_tokens = maxTok
        payload.thinking_mode = llmThinkingMode
      }
      payload.timeout_seconds = timeout
      payload.llm_idle_timeout_seconds = idleTimeout
      payload.skip_bootstrap = llmSkipBootstrap
      await api.updateAgentLLMConfig(teamId, agent.id, payload as Parameters<typeof api.updateAgentLLMConfig>[2])
      setLlmApiKey('')
      await loadLLMConfig()
      showToast(lang === 'zh' ? '✅ 配置已保存' : '✅ Config saved')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLlmSaving(false)
    }
  }

  const handleLlmReset = async () => {
    setLlmResetting(true)
    try {
      await api.resetAgentLLMConfig(teamId, agent.id)
      await loadLLMConfig()
      showToast(lang === 'zh' ? '已恢复继承配置' : 'Reset to inherited config')
    } catch {
      showToast('Reset failed')
    } finally {
      setLlmResetting(false)
    }
  }


  const isDirty = (fileKey: keyof AgentFiles) => editedFiles[fileKey] !== files[fileKey]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: lang === 'zh' ? '概览' : 'Overview' },
    { id: 'identity', label: lang === 'zh' ? '身份' : 'Identity' },
    { id: 'soul',     label: lang === 'zh' ? '灵魂' : 'Soul' },
    { id: 'memory',   label: lang === 'zh' ? '记忆' : 'Memory' },
    { id: 'llm',      label: 'LLM' },
    { id: 'console',  label: lang === 'zh' ? '日志' : 'Console' },
  ]

  const LOG_COLORS: Record<string, string> = {
    INFO: '#8B949E', TOOL: '#58A6FF', WARN: '#D29922',
    ERROR: '#F85149', SUCCESS: '#3FB950', DECISION: '#D29922',
  }

  const fileKey = activeTab as keyof AgentFiles

  const llmInputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)',
    borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const llmLabelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 100, cursor: 'pointer',
      }} />

      {/* Drawer -- slides from RIGHT */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(640px, 90vw)',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow: '-6px 0 24px rgba(0,0,0,.3)',
        zIndex: 101,
        display: 'flex', flexDirection: 'column',
        animation: 'drawer-slide-in-right 0.25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: agent.is_master
              ? 'linear-gradient(135deg,var(--success),#56d364)'
              : 'linear-gradient(135deg,var(--accent),#79c0ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 16, fontWeight: 700, color: '#fff',
          }}>
            {agent.name[0]?.toUpperCase() ?? <Bot size={16} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {agent.name}
              {agent.is_master && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(63,185,80,.12)', color: 'var(--success)', fontWeight: 500 }}>
                  {lang === 'zh' ? '主管' : 'Master'}
                </span>
              )}
              <StatusBadge status={agent.status} small />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.role}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
          overflowX: 'auto',
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id) }} style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>
              {tab.label}
              {tab.id === 'console' && liveConnected && (
                <span style={{ marginLeft: 4, width: 6, height: 6, borderRadius: '50%', background: '#3FB950', display: 'inline-block', verticalAlign: 'middle' }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', marginBottom: 12, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {lang === 'zh' ? '运行状态' : 'Runtime'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow label={lang === 'zh' ? '状态' : 'Status'} value={<StatusBadge status={agent.status} small />} />
                  {agent.container_id && (
                    <InfoRow label={lang === 'zh' ? '容器 ID' : 'Container'} value={
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-code)' }}>{agent.container_id}</span>
                    } />
                  )}
                  <InfoRow label={lang === 'zh' ? '角色' : 'Role'} value={agent.role} />
                </div>
              </div>

              {agent.current_task && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', marginBottom: 12, border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {lang === 'zh' ? '当前任务' : 'Current Task'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{agent.current_task}</div>
                </div>
              )}

              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {lang === 'zh' ? '快速操作' : 'Quick Actions'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveTab('identity')}
                    style={{ flex: 1, padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {lang === 'zh' ? '📄 编辑配置' : '📄 Edit Config'}
                  </button>
                  <button onClick={() => setActiveTab('console')}
                    style={{ flex: 1, padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {lang === 'zh' ? '🖥️ 查看日志' : '🖥️ View Logs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Identity / Soul / Memory -- editable textarea */}
          {(activeTab === 'identity' || activeTab === 'soul' || activeTab === 'memory') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {filesError ? (
                  <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 0' }}>
                    {lang === 'zh' ? '加载失败' : 'Failed to load file'}
                  </div>
                ) : (
                  <textarea
                    value={editedFiles[fileKey]}
                    onChange={e => setEditedFiles(prev => ({ ...prev, [fileKey]: e.target.value }))}
                    style={{
                      flex: 1, width: '100%', background: 'var(--bg-base)',
                      border: `1px solid ${isDirty(fileKey) ? 'var(--accent)' : 'var(--border-default)'}`,
                      borderRadius: 6, padding: '10px 12px', fontSize: 12,
                      color: 'var(--text-primary)', fontFamily: 'monospace',
                      lineHeight: 1.6, resize: 'none', outline: 'none',
                      boxSizing: 'border-box', transition: 'border-color 0.15s',
                    }}
                  />
                )}
              </div>

              {/* Toast */}
              {toast && (
                <div style={{ margin: '0 14px 8px', fontSize: 12, color: toast.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>
                  {toast}
                </div>
              )}

              {/* Save / Discard footer */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
                <button
                  onClick={() => setEditedFiles(prev => ({ ...prev, [fileKey]: files[fileKey] }))}
                  disabled={!isDirty(fileKey) || saving}
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: (!isDirty(fileKey) || saving) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: (!isDirty(fileKey) || saving) ? 0.5 : 1 }}>
                  {lang === 'zh' ? '还原' : 'Discard'}
                </button>
                <button
                  onClick={() => handleSaveFile(fileKey)}
                  disabled={!isDirty(fileKey) || saving || filesError}
                  style={{ padding: '6px 14px', background: (isDirty(fileKey) && !saving && !filesError) ? 'var(--accent)' : 'var(--bg-card)', color: (isDirty(fileKey) && !saving && !filesError) ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: (!isDirty(fileKey) || saving || filesError) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                  {saving ? (lang === 'zh' ? '保存中…' : 'Saving…') : (lang === 'zh' ? '保存' : 'Save')}
                </button>
              </div>
            </div>
          )}

          {/* LLM tab */}
          {activeTab === 'llm' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {llmLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 40, background: 'var(--bg-card)', borderRadius: 6 }} />
                  ))}
                </div>
              ) : (
                <div style={{ maxWidth: 520 }}>
                  {/* Inheritance badge */}
                  {!llmIsOverride && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(88,166,255,.06)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 6, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>ℹ️</span>
                      {llmInheritsFrom === 'team'
                        ? (lang === 'zh' ? '继承团队 LLM 配置。保存后将创建此 agent 的独立覆盖。' : 'Inheriting from team config. Saving will create an agent-level override.')
                        : (lang === 'zh' ? '继承全局 LLM 配置。保存后将创建此 agent 的独立覆盖。' : 'Inheriting from global config. Saving will create an agent-level override.')}
                    </div>
                  )}
                  {llmIsOverride && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(63,185,80,.06)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 6, marginBottom: 20, fontSize: 12, color: 'var(--success)' }}>
                      <span>✅</span>
                      {lang === 'zh' ? '此 agent 使用独立 LLM 配置' : 'This agent has a custom LLM override'}
                      <button onClick={handleLlmReset} disabled={llmResetting}
                        style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 8px', cursor: llmResetting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {llmResetting ? '…' : (lang === 'zh' ? '恢复继承' : 'Reset to inherited')}
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Provider */}
                    <div>
                      <label style={llmLabelStyle}>{lang === 'zh' ? 'LLM 供应商' : 'Provider'}</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {LLM_PROVIDERS.map(p => (
                          <button key={p.id} onClick={() => handleLlmProviderChange(p.id)}
                            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: llmProvider === p.id ? 'var(--accent)' : 'var(--bg-card)', color: llmProvider === p.id ? '#fff' : 'var(--text-secondary)', border: `1px solid ${llmProvider === p.id ? 'var(--accent)' : 'var(--border-default)'}` }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Model */}
                    <div>
                      <label style={llmLabelStyle}>{lang === 'zh' ? '模型' : 'Model'}</label>
                      {LLM_MODELS[llmProvider]?.length ? (
                        <>
                          <select value={llmModel} onChange={e => setLlmModel(e.target.value)}
                            style={{ ...llmInputStyle, cursor: 'pointer' }}
                            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }}>
                            {LLM_MODELS[llmProvider].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            <option value="__custom__">{lang === 'zh' ? '自定义…' : 'Custom…'}</option>
                          </select>
                          {llmModel === '__custom__' && (
                            <input type="text" value={llmCustomModel} onChange={e => setLlmCustomModel(e.target.value)}
                              placeholder={lang === 'zh' ? '输入模型名称' : 'Enter model name'}
                              style={{ ...llmInputStyle, marginTop: 8 }}
                              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                          )}
                        </>
                      ) : (
                        <input type="text" value={llmCustomModel} onChange={e => setLlmCustomModel(e.target.value)}
                          placeholder={lang === 'zh' ? '输入模型名称' : 'Enter model name'}
                          style={llmInputStyle}
                          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                      )}
                    </div>

                    {/* API Key */}
                    <div>
                      <label style={llmLabelStyle}>
                        API Key
                        {llmMaskedKey && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>({lang === 'zh' ? '已设置' : 'set'}: {llmMaskedKey})</span>}
                      </label>
                      <input type="password" value={llmApiKey} onChange={e => setLlmApiKey(e.target.value)}
                        placeholder={llmMaskedKey
                          ? (lang === 'zh' ? '输入新 Key 以更新' : 'Enter new key to update')
                          : (lang === 'zh' ? '输入 API Key' : 'Enter API key')}
                        style={llmInputStyle}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                    </div>

                    {/* Base URL */}
                    {LLM_URL_REQUIRED.has(llmProvider) && (
                      <div>
                        <label style={llmLabelStyle}>Base URL</label>
                        <input type="url" value={llmBaseUrl} onChange={e => setLlmBaseUrl(e.target.value)}
                          placeholder={llmProvider === 'ollama' ? 'http://localhost:11434' : 'https://your-api.example.com/v1'}
                          style={llmInputStyle}
                          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                      </div>
                    )}

                    {/* Context Window (Custom only) */}
                    {llmProvider === 'custom' && (
                      <div>
                        <label style={llmLabelStyle}>
                          Context Window
                          <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                            ({lang === 'zh' ? '模型上下文窗口大小（tokens）' : 'model context window size (tokens)'})
                          </span>
                        </label>
                        <input type="number" value={llmContextWindow} onChange={e => setLlmContextWindow(e.target.value)}
                          min={1024} max={1048576} step={1024} placeholder="32768"
                          style={llmInputStyle}
                          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                      </div>
                    )}

                    {/* Max Tokens (Custom only) */}
                    {llmProvider === 'custom' && (
                      <div>
                        <label style={llmLabelStyle}>
                          Max Tokens
                          <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                            ({lang === 'zh' ? '单次生成最大 token 数' : 'max tokens per generation'})
                          </span>
                        </label>
                        <input type="number" value={llmMaxTokens} onChange={e => setLlmMaxTokens(e.target.value)}
                          min={256} max={Number(llmContextWindow) || 1048576} step={256} placeholder="4096"
                          style={llmInputStyle}
                          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                      </div>
                    )}

                    {/* Turn timeout */}
                    <div>
                      <label style={llmLabelStyle}>
                        {lang === 'zh' ? '回合超时（秒）' : 'Turn timeout (seconds)'}
                        <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                          ({lang === 'zh' ? '整个 agent 回合的最长时间' : 'whole-turn budget'})
                        </span>
                      </label>
                      <input type="number" value={llmTimeoutSeconds} onChange={e => setLlmTimeoutSeconds(e.target.value)}
                        min={10} max={3600} step={60} placeholder="1800"
                        style={llmInputStyle}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                    </div>

                    {/* First-token timeout */}
                    <div>
                      <label style={llmLabelStyle}>
                        {lang === 'zh' ? '首字符超时（秒）' : 'First-token timeout (seconds)'}
                        <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                          ({lang === 'zh' ? '每次 LLM 调用等待首字符的时间' : 'per-LLM-call first-token wait'})
                        </span>
                      </label>
                      <input type="number" value={llmIdleTimeoutSeconds} onChange={e => setLlmIdleTimeoutSeconds(e.target.value)}
                        min={10} max={3600} step={10} placeholder="300"
                        style={llmInputStyle}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
                    </div>

                    {/* Skip Bootstrap */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13 }}>{lang === 'zh' ? '跳过引导' : 'Skip bootstrap'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
                          {lang === 'zh'
                            ? '缩短系统提示，降低首字符延迟'
                            : 'halve system prompt, cuts first-token latency'}
                        </div>
                      </div>
                      <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={llmSkipBootstrap} onChange={e => setLlmSkipBootstrap(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: 11, background: llmSkipBootstrap ? 'var(--accent)' : 'var(--border-default)', transition: 'background 0.2s' }} />
                        <div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: llmSkipBootstrap ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
                      </label>
                    </div>

                    {/* Thinking Mode (Custom only) */}
                    {llmProvider === 'custom' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 13 }}>{lang === 'zh' ? '思考模式' : 'Thinking Mode'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
                            {lang === 'zh'
                              ? '启用模型推理/思考链'
                              : 'enable model reasoning/CoT'}
                          </div>
                        </div>
                        <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }}>
                          <input type="checkbox" checked={llmThinkingMode} onChange={e => setLlmThinkingMode(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                          <div style={{ position: 'absolute', inset: 0, borderRadius: 11, background: llmThinkingMode ? 'var(--accent)' : 'var(--border-default)', transition: 'background 0.2s' }} />
                          <div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: llmThinkingMode ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
                        </label>
                      </div>
                    )}

                    {/* Save */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
                      <button onClick={handleLlmSave} disabled={llmSaving}
                        style={{ padding: '8px 20px', background: llmSaving ? 'var(--bg-card)' : 'var(--accent)', color: llmSaving ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: llmSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {llmSaving ? (lang === 'zh' ? '保存中…' : 'Saving…') : (lang === 'zh' ? '保存并应用' : 'Save & Apply')}
                      </button>
                    </div>
                  </div>

                  {/* Toast */}
                  {toast && (
                    <div style={{ marginTop: 12, fontSize: 13, color: toast.includes('failed') || toast.includes('失败') ? 'var(--danger)' : 'var(--success)' }}>
                      {toast}
                    </div>
                  )}
                </div>
              )}

              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {/* Console tab */}
          {activeTab === 'console' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div ref={consoleRef} style={{
                flex: 1, overflowY: 'auto', padding: '10px 14px',
                background: '#0D1117', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
              }}>
                {logs.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Waiting for logs...</span>}
                {logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: 1, color: LOG_COLORS[log.type] || '#8B949E' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}>{log.timestamp}</span>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>[{log.type}]</span>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes drawer-slide-in-right {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
