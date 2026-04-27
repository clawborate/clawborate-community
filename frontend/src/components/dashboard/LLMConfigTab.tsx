'use client'
/**
 * LLMConfigTab — per-team LLM configuration panel.
 *
 * Lives in the "Config" tab of MainPanel. Includes all LLM fields,
 * heartbeat frequency and auto-execute notifications.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'

interface Props {
  teamId: string
}

const PROVIDERS = [
  { id: 'openai',    label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'ollama',    label: 'Ollama (Local)' },
  { id: 'custom',    label: 'Custom / Other' },
]

const MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-5', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  ollama:    ['llama3', 'mistral', 'gemma2', 'phi3'],
  custom:    [],
}

const URL_REQUIRED = new Set(['ollama', 'custom'])

const HEARTBEAT_OPTIONS = ['1min', '2min', '5min', '10min', 'off'] as const
type HeartbeatValue = typeof HEARTBEAT_OPTIONS[number]
const HEARTBEAT_LABELS: Record<HeartbeatValue, string> = {
  '1min': '1 min', '2min': '2 min', '5min': '5 min', '10min': '10 min', 'off': 'Off',
}

export default function LLMConfigTab({ teamId }: Props) {
  const { lang } = useLang()

  const [provider, setProvider]       = useState('openai')
  const [model, setModel]             = useState('')
  const [apiKey, setApiKey]           = useState('')
  const [maskedKey, setMaskedKey]     = useState('')
  const [baseUrl, setBaseUrl]         = useState('')
  const [contextWindow, setContextWindow] = useState('')
  const [maxTokens, setMaxTokens]     = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState('1800')
  const [llmIdleTimeoutSeconds, setLlmIdleTimeoutSeconds] = useState('300')
  const [thinkingMode, setThinkingMode] = useState(false)
  const [skipBootstrap, setSkipBootstrap] = useState(false)
  const [isOverride, setIsOverride]   = useState(false)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [resetting, setResetting]     = useState(false)
  const [toast, setToast]             = useState('')
  const [customModel, setCustomModel] = useState('')

  // Heartbeat
  const [heartbeat, setHeartbeat] = useState<HeartbeatValue>('5min')
  const heartbeatUserChanged = useRef(false)

  // Notifications (localStorage-only)
  const [autoExecute, setAutoExecute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('clawborate-auto-execute') !== '0'
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getTeamLLMConfig(teamId)
      const llm = res.llm ?? {}
      setProvider(llm.provider ?? 'openai')
      const prov = llm.provider ?? 'openai'
      const models = MODELS[prov] ?? []
      if (models.length === 0) {
        // Provider has no predefined models (e.g. custom) — always use customModel
        setModel('__custom__')
        setCustomModel(llm.model ?? '')
      } else if (llm.model && !models.includes(llm.model)) {
        // Model not in predefined list — show custom input
        setModel('__custom__')
        setCustomModel(llm.model)
      } else {
        setModel(llm.model ?? models[0] ?? '')
        setCustomModel('')
      }
      setMaskedKey(llm.api_key_masked ?? '')
      setBaseUrl(llm.base_url ?? '')
      setContextWindow(llm.context_window ? String(llm.context_window) : '')
      setMaxTokens(llm.max_tokens ? String(llm.max_tokens) : '')
      setTimeoutSeconds(String(llm.timeout_seconds ?? 1800))
      setLlmIdleTimeoutSeconds(String(llm.llm_idle_timeout_seconds ?? 300))
      setThinkingMode(llm.thinking_mode ?? false)
      setSkipBootstrap(llm.skip_bootstrap ?? false)
      setIsOverride(res.is_override)
    } catch { /* leave defaults */ }
    finally { setLoading(false) }
  }, [teamId])

  useEffect(() => { load() }, [load])

  // Load team heartbeat
  useEffect(() => {
    api.getTeamHeartbeat(teamId).then(res => {
      const eff = res.effective as HeartbeatValue
      if ((HEARTBEAT_OPTIONS as readonly string[]).includes(eff)) {
        setHeartbeat(eff)
      }
    }).catch(() => {})
  }, [teamId])

  // Save heartbeat when user explicitly changes it
  useEffect(() => {
    if (!heartbeatUserChanged.current) return
    api.updateTeamHeartbeat(teamId, heartbeat).then(() => {
      showToast(lang === 'zh' ? '心跳配置已保存' : 'Heartbeat config saved')
    }).catch(() => {})
  }, [heartbeat, teamId])

  // For providers with no predefined models (custom), always use customModel.
  // For others, use customModel only when user selected "Custom…" in dropdown.
  const effectiveModel = (!MODELS[provider]?.length || model === '__custom__') ? customModel : model

  // Ctrl+X: export LLM config as JSON file
  // Ctrl+I: import LLM config from JSON file
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        const config: Record<string, unknown> = {
          provider,
          model: effectiveModel,
          api_key: apiKey || maskedKey || '',
          base_url: baseUrl || '',
          context_window: Number(contextWindow) || 0,
          max_tokens: Number(maxTokens) || 0,
          timeout_seconds: Number(timeoutSeconds) || 1800,
          llm_idle_timeout_seconds: Number(llmIdleTimeoutSeconds) || 300,
          thinking_mode: thinkingMode,
          skip_bootstrap: skipBootstrap,
        }
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `llm-config-${teamId}.json`
        a.click()
        URL.revokeObjectURL(url)
        showToast(lang === 'zh' ? '配置已导出' : 'Config exported')
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          try {
            const text = await file.text()
            const config = JSON.parse(text)
            if (config.provider) setProvider(config.provider)
            if (config.model) {
              const models = MODELS[config.provider] ?? []
              if (models.length === 0 || !models.includes(config.model)) {
                setModel('__custom__')
                setCustomModel(config.model)
              } else {
                setModel(config.model)
                setCustomModel('')
              }
            }
            if (config.base_url !== undefined) setBaseUrl(config.base_url)
            if (config.api_key) setApiKey(config.api_key)
            if (config.context_window !== undefined) setContextWindow(String(config.context_window))
            if (config.max_tokens !== undefined) setMaxTokens(String(config.max_tokens))
            if (config.timeout_seconds !== undefined) setTimeoutSeconds(String(config.timeout_seconds))
            if (config.llm_idle_timeout_seconds !== undefined) setLlmIdleTimeoutSeconds(String(config.llm_idle_timeout_seconds))
            if (config.thinking_mode !== undefined) setThinkingMode(config.thinking_mode)
            if (config.skip_bootstrap !== undefined) setSkipBootstrap(config.skip_bootstrap)
            showToast(lang === 'zh' ? '配置已导入，请点击保存' : 'Config imported — click Save to apply')
          } catch {
            showToast(lang === 'zh' ? '导入失败：JSON 格式错误' : 'Import failed: invalid JSON')
          }
        }
        input.click()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, effectiveModel, apiKey, maskedKey, baseUrl, contextWindow, maxTokens, timeoutSeconds, llmIdleTimeoutSeconds, thinkingMode, skipBootstrap, teamId, lang])


  // Reset model when provider changes
  const handleProviderChange = (p: string) => {
    setProvider(p)
    const first = MODELS[p]?.[0] ?? ''
    setModel(first)
    setCustomModel('')
  }

  const handleSave = async () => {
    if (!effectiveModel.trim()) {
      showToast(lang === 'zh' ? '请输入模型名称' : 'Model name is required')
      return
    }
    const timeout = Number(timeoutSeconds) || 1800
    const idleTimeout = Number(llmIdleTimeoutSeconds) || 300
    if (timeout < 10 || timeout > 3600) {
      showToast(lang === 'zh' ? '超时时间必须在 10-3600 秒之间' : 'Timeout must be between 10 and 3600 seconds')
      return
    }
    if (idleTimeout < 10 || idleTimeout > 3600) {
      showToast(lang === 'zh' ? '首字符超时必须在 10-3600 秒之间' : 'First-token timeout must be between 10 and 3600 seconds')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        provider,
        model: effectiveModel.trim(),
      }
      if (apiKey.trim()) payload.api_key = apiKey.trim()
      if (baseUrl.trim()) payload.base_url = baseUrl.trim()
      if (provider === 'custom') {
        const ctxWin = Number(contextWindow)
        const maxTok = Number(maxTokens)
        if (ctxWin) payload.context_window = ctxWin
        if (maxTok) payload.max_tokens = maxTok
        payload.thinking_mode = thinkingMode
      }
      payload.timeout_seconds = timeout
      payload.llm_idle_timeout_seconds = idleTimeout
      payload.skip_bootstrap = skipBootstrap
      await api.updateTeamLLMConfig(teamId, payload as Parameters<typeof api.updateTeamLLMConfig>[1])
      // Persist auto-execute setting
      localStorage.setItem('clawborate-auto-execute', autoExecute ? '1' : '0')
      api.updateNotificationSettings(autoExecute).catch(() => {})
      setApiKey('')  // clear plaintext after save
      setIsOverride(true)
      await load()   // reload to get masked key
      showToast(lang === 'zh' ? '配置已保存' : 'Config saved')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await api.resetTeamLLMConfig(teamId)
      setIsOverride(false)
      await load()
      showToast(lang === 'zh' ? '已恢复全局配置' : 'Reset to global config')
    } catch {
      showToast('Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)',
    borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
  }

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
    <div style={{ maxWidth: 560 }}>
      {/* Override / inheriting badge */}
      {!isOverride && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(88,166,255,.06)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 6, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>ℹ️</span>
          {lang === 'zh'
            ? '当前使用全局 LLM 配置。保存后将仅影响此团队。'
            : 'Currently inheriting global LLM config. Saving will create a team-level override.'}
        </div>
      )}
      {isOverride && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(63,185,80,.06)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 6, marginBottom: 20, fontSize: 12, color: 'var(--success)' }}>
          <span>✅</span>
          {lang === 'zh' ? '此团队使用独立 LLM 配置' : 'This team has a custom LLM override'}
          <button onClick={handleReset} disabled={resetting}
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 8px', cursor: resetting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {resetting ? '…' : (lang === 'zh' ? '恢复全局' : 'Reset to global')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Provider */}
        <div>
          <label style={labelStyle}>{lang === 'zh' ? 'LLM 供应商' : 'Provider'}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => handleProviderChange(p.id)}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: provider === p.id ? 'var(--accent)' : 'var(--bg-card)', color: provider === p.id ? '#fff' : 'var(--text-secondary)', border: `1px solid ${provider === p.id ? 'var(--accent)' : 'var(--border-default)'}` }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label style={labelStyle}>{lang === 'zh' ? '模型' : 'Model'}</label>
          {MODELS[provider]?.length ? (
            <>
              <select value={model} onChange={e => setModel(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }}>
                {MODELS[provider].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">{lang === 'zh' ? '自定义…' : 'Custom…'}</option>
              </select>
              {model === '__custom__' && (
                <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
                  placeholder={lang === 'zh' ? '输入模型名称' : 'Enter model name'}
                  style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                  onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
              )}
            </>
          ) : (
            <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
              placeholder={lang === 'zh' ? '输入模型名称' : 'Enter model name'}
              style={inputStyle}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          )}
        </div>

        {/* API Key */}
        <div>
          <label style={labelStyle}>
            API Key
            {maskedKey && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>({lang === 'zh' ? '已设置' : 'set'}: {maskedKey})</span>}
          </label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder={maskedKey
              ? (lang === 'zh' ? '输入新 Key 以更新' : 'Enter new key to update')
              : (lang === 'zh' ? '输入 API Key' : 'Enter API key')}
            style={inputStyle}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
        </div>

        {/* Base URL */}
        {URL_REQUIRED.has(provider) && (
          <div>
            <label style={labelStyle}>Base URL</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'https://your-api.example.com/v1'}
              style={inputStyle}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          </div>
        )}

        {/* Context Window (Custom only) */}
        {provider === 'custom' && (
          <div>
            <label style={labelStyle}>
              Context Window
              <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                ({lang === 'zh' ? '模型上下文窗口大小（tokens）' : 'model context window size (tokens)'})
              </span>
            </label>
            <input type="number" value={contextWindow} onChange={e => setContextWindow(e.target.value)}
              min={1024} max={1048576} step={1024}
              placeholder="32768"
              style={inputStyle}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          </div>
        )}

        {/* Max Tokens (Custom only) */}
        {provider === 'custom' && (
          <div>
            <label style={labelStyle}>
              Max Tokens
              <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
                ({lang === 'zh' ? '单次生成最大 token 数' : 'max tokens per generation'})
              </span>
            </label>
            <input type="number" value={maxTokens} onChange={e => setMaxTokens(e.target.value)}
              min={256} max={Number(contextWindow) || 1048576} step={256}
              placeholder="4096"
              style={inputStyle}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          </div>
        )}

        {/* Turn timeout */}
        <div>
          <label style={labelStyle}>
            {lang === 'zh' ? '回合超时（秒）' : 'Turn timeout (seconds)'}
            <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
              ({lang === 'zh'
                ? '整个 agent 回合的最长时间（防止失控循环）'
                : 'whole-turn budget (runaway-loop protection)'})
            </span>
          </label>
          <input type="number" value={timeoutSeconds} onChange={e => setTimeoutSeconds(e.target.value)}
            min={10} max={3600} step={60}
            placeholder="1800"
            style={inputStyle}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
        </div>

        {/* First-token timeout */}
        <div>
          <label style={labelStyle}>
            {lang === 'zh' ? '首字符超时（秒）' : 'First-token timeout (seconds)'}
            <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: 4 }}>
              ({lang === 'zh'
                ? '每次 LLM 调用等待首字符的时间'
                : 'per-LLM-call first-token wait'})
            </span>
          </label>
          <input type="number" value={llmIdleTimeoutSeconds} onChange={e => setLlmIdleTimeoutSeconds(e.target.value)}
            min={10} max={3600} step={10}
            placeholder="300"
            style={inputStyle}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
        </div>

        {/* Skip Bootstrap */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13 }}>{lang === 'zh' ? '跳过引导（缩短系统提示）' : 'Skip bootstrap'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
              {lang === 'zh'
                ? '将 OpenClaw 注入的 38K 字符系统提示削减约一半，可大幅降低首字符延迟'
                : 'halve openclaw\'s ~38K-char system prompt, materially cuts first-token latency'}
            </div>
          </div>
          <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={skipBootstrap} onChange={e => setSkipBootstrap(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 11, background: skipBootstrap ? 'var(--accent)' : 'var(--border-default)', transition: 'background 0.2s' }} />
            <div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: skipBootstrap ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </label>
        </div>

        {/* Thinking Mode (Custom only) */}
        {provider === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13 }}>{lang === 'zh' ? '思考模式 (Thinking Mode)' : 'Thinking Mode'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
                {lang === 'zh'
                  ? '启用模型的推理/思考链（仅对支持的模型有效，如 qwen3）'
                  : 'enable model reasoning/CoT (only effective for supporting models, e.g. qwen3)'}
              </div>
            </div>
            <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={thinkingMode} onChange={e => setThinkingMode(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 11, background: thinkingMode ? 'var(--accent)' : 'var(--border-default)', transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: thinkingMode ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
            </label>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />

        {/* Heartbeat */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            {lang === 'zh' ? 'Agents' : 'Agents'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 12 }}>
            {lang === 'zh' ? 'agents 自动检查新任务的频率。' : 'How often agents automatically check for new tasks.'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {lang === 'zh' ? '心跳频率' : 'Heartbeat Frequency'}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {HEARTBEAT_OPTIONS.map(opt => {
              const active = heartbeat === opt
              const label = opt === 'off' ? (lang === 'zh' ? '关闭' : 'Off') : HEARTBEAT_LABELS[opt]
              return (
                <button key={opt}
                  onClick={() => { heartbeatUserChanged.current = true; setHeartbeat(opt) }}
                  style={{
                    padding: '4px 11px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                    background: active ? 'var(--accent)' : 'none',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />

        {/* Notifications */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Notifications
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 14 }}>
            {lang === 'zh' ? '当通知需要 agent LLM 处理时。' : 'When a notification requires LLM processing by the agent.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13 }}>Auto Execute</div>
              <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>
                {lang === 'zh' ? 'Agent 自动处理通知' : 'Agent handles notifications automatically'}
              </div>
            </div>
            <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={autoExecute} onChange={e => setAutoExecute(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 11, background: autoExecute ? 'var(--accent)' : 'var(--border-default)', transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: autoExecute ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
            </label>
          </div>
          {!autoExecute && (
            <div style={{
              marginTop: 10, fontSize: 11, color: 'var(--text-secondary)',
              background: 'rgba(88,166,255,.07)', border: '1px solid rgba(88,166,255,.18)',
              borderRadius: 6, padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {lang === 'zh'
                ? '手动模式：需要 agent 操作的通知上会显示「授权 ▷」按钮。'
                : <>Manual mode: an <strong style={{ margin: '0 3px' }}>Authorize ▷</strong> button will appear on notifications that require agent action.</>}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-disabled)', display: 'flex', gap: 12 }}>
          <span>⌘/Ctrl+X {lang === 'zh' ? '导出配置' : 'Export config'}</span>
          <span>⌘/Ctrl+I {lang === 'zh' ? '导入配置' : 'Import config'}</span>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />

        <div style={{ fontSize: 11, color: 'var(--text-disabled)', display: 'flex', gap: 12 }}>
          <span>⌘/Ctrl+X {lang === 'zh' ? '导出配置' : 'Export config'}</span>
          <span>⌘/Ctrl+I {lang === 'zh' ? '导入配置' : 'Import config'}</span>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', background: saving ? 'var(--bg-card)' : 'var(--accent)', color: saving ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}>
            {saving ? (lang === 'zh' ? '保存中…' : 'Saving…') : (lang === 'zh' ? '保存并应用' : 'Save & Apply')}
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
  )
}
