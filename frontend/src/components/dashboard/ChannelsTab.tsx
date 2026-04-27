'use client'
/**
 * ChannelsTab — M3-D2: chat channel configuration for the Config tab.
 *
 * Displays connected/disconnected chat channels for the team and allows:
 *   - Toggling a channel's connected status
 *   - Removing a channel
 *   - Adding a new channel (inline form)
 *
 * Supported channel types:
 *   Telegram, Signal, Discord, Slack, WhatsApp, Custom
 *
 * Acceptance criteria:
 *   ✅ Channel list with icon + name + status dot
 *   ✅ Connected channels show green status dot
 *   ✅ Disconnect (toggle) operation
 *   ✅ Add new channel flow
 *   ✅ Config persisted to team data
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'
import { useLang } from '@/hooks/useLang'

interface Channel {
  id: string
  type: string
  name: string
  connected: boolean
  config: Record<string, unknown>
  added_at: string
}

interface Props {
  teamId: string
}

const CHANNEL_TYPES = [
  { id: 'telegram',  label: 'Telegram',  icon: '✈️' },
  { id: 'signal',    label: 'Signal',    icon: '🔐' },
  { id: 'discord',   label: 'Discord',   icon: '🎮' },
  { id: 'slack',     label: 'Slack',     icon: '💬' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '📱' },
  { id: 'custom',    label: 'Custom',    icon: '🔗' },
]

function channelIcon(type: string): string {
  return CHANNEL_TYPES.find(t => t.id === type)?.icon ?? '💬'
}

export default function ChannelsTab({ teamId }: Props) {
  const { lang } = useLang()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState('telegram')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listChannels(teamId)
      setChannels(res.channels ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [teamId])

  useEffect(() => { loadChannels() }, [loadChannels])

  const handleToggle = async (ch: Channel) => {
    try {
      await api.updateChannelStatus(teamId, ch.id, !ch.connected)
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, connected: !c.connected } : c))
    } catch {
      showToast(lang === 'zh' ? '操作失败' : 'Operation failed')
    }
  }

  const handleRemove = async (ch: Channel) => {
    try {
      await api.removeChannel(teamId, ch.id)
      setChannels(prev => prev.filter(c => c.id !== ch.id))
      showToast(lang === 'zh' ? '已移除' : 'Removed')
    } catch {
      showToast(lang === 'zh' ? '移除失败' : 'Remove failed')
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await api.addChannel(teamId, { type: newType, name: newName.trim() })
      setNewName('')
      setShowAdd(false)
      await loadChannels()
      showToast(lang === 'zh' ? '✅ 已添加' : '✅ Added')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: 52, background: 'var(--bg-card)', borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {lang === 'zh' ? '聊天渠道' : 'Chat Channels'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {lang === 'zh' ? '管理与外部平台的消息集成' : 'Manage messaging integrations'}
          </div>
        </div>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showAdd ? 'var(--bg-card)' : 'var(--accent)', color: showAdd ? 'var(--text-secondary)' : '#fff', border: showAdd ? '1px solid var(--border-default)' : 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
          <Plus size={12} />
          {lang === 'zh' ? '添加渠道' : 'Add channel'}
        </button>
      </div>

      {/* Add channel form */}
      {showAdd && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
            {lang === 'zh' ? '新增渠道' : 'New channel'}
          </div>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {CHANNEL_TYPES.map(t => (
              <button key={t.id} onClick={() => setNewType(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: newType === t.id ? 'var(--accent)' : 'var(--bg-card)', color: newType === t.id ? '#fff' : 'var(--text-secondary)', border: `1px solid ${newType === t.id ? 'var(--accent)' : 'var(--border-default)'}`, transition: 'all 0.15s' }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          {/* Name input */}
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={lang === 'zh' ? '渠道名称（如 @MyBot）' : 'Channel name (e.g. @MyBot)'}
            style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '7px 11px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={adding || !newName.trim()}
              style={{ padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: adding || !newName.trim() ? 0.5 : 1 }}>
              {adding ? '…' : (lang === 'zh' ? '添加' : 'Add')}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName('') }}
              style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Channel list */}
      {channels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
          {lang === 'zh' ? '暂无配置的聊天渠道' : 'No chat channels configured'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {channels.map(ch => (
            <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, transition: 'border-color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,148,158,.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)' }}>
              {/* Channel type icon */}
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {channelIcon(ch.type)}
              </div>
              {/* Name + type */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {CHANNEL_TYPES.find(t => t.id === ch.type)?.label ?? ch.type}
                </div>
              </div>
              {/* Status dot + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: ch.connected ? 'var(--success)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: 11, color: ch.connected ? 'var(--success)' : 'var(--text-muted)' }}>
                  {ch.connected
                    ? (lang === 'zh' ? '已连接' : 'Connected')
                    : (lang === 'zh' ? '未连接' : 'Disconnected')}
                </span>
              </div>
              {/* Toggle connect button */}
              <button onClick={() => handleToggle(ch)} title={ch.connected ? (lang === 'zh' ? '断开' : 'Disconnect') : (lang === 'zh' ? '连接' : 'Connect')}
                style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)' }}>
                {ch.connected ? <WifiOff size={13} color="var(--text-secondary)" /> : <Wifi size={13} color="var(--accent)" />}
              </button>
              {/* Remove button */}
              <button onClick={() => handleRemove(ch)} title={lang === 'zh' ? '移除' : 'Remove'}
                style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--danger)'; el.style.background = 'rgba(248,81,73,.08)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-default)'; el.style.background = '' }}>
                <Trash2 size={13} color="var(--text-muted)" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
