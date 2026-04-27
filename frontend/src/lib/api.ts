const BASE = '/api'

// Global refresh lock — prevents concurrent 401s from triggering multiple refresh calls
let _refreshPromise: Promise<boolean> | null = null
// In-memory cache for token expiry — avoids re-parsing document.cookie on every request
let _cachedTokenExpiry: number | null = null

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = fetch('/api/auth/refresh', { method: 'POST' })
    .then(res => {
      if (res.ok) _cachedTokenExpiry = Math.floor(Date.now() / 1000) + 3600
      return res.ok
    })
    .catch(() => false)
    .finally(() => { _refreshPromise = null })
  return _refreshPromise
}

/** Proactively refresh if token_expiry shows <5 min remaining. */
export async function proactiveRefresh(): Promise<void> {
  if (typeof document === 'undefined') return
  // Populate cache from cookie on first call or after cache is cleared
  if (_cachedTokenExpiry === null) {
    const match = document.cookie.match(/(?:^|;\s*)token_expiry=(\d+)/)
    if (!match) return
    _cachedTokenExpiry = parseInt(match[1], 10)
  }
  const now = Math.floor(Date.now() / 1000)
  if (_cachedTokenExpiry - now < 300) {
    await tryRefreshToken()
  }
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?redirect=${redirect}`
  }
}

async function request<T>(path: string, options?: RequestInit, _retried = false): Promise<T> {
  await proactiveRefresh()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (res.status === 401) {
    if (!_retried) {
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        return request<T>(path, options, true)
      }
    }
    redirectToLogin()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    // Pydantic validation errors return detail as an array of objects
    const detail = Array.isArray(err.detail)
      ? err.detail.map((e: { msg?: string; loc?: string[] }) => e.msg ?? JSON.stringify(e)).join('; ')
      : (err.detail || 'Request failed')
    throw new Error(detail)
  }
  return res.json()
}

export interface TemplateAgent {
  id_suffix: string
  name: string
  role: string
  description: string
  is_master: boolean
}

export interface Template {
  id: string
  display_name: string
  default_team_name: string
  default_team_name_zh: string
  description: string
  agents: TemplateAgent[]
}


export interface CommunityTemplateInfo {
  id: string
  name: string
  description: string | null
  source: string
  template_type: string
  content: string
  is_approved: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  is_recommended: boolean
  screenshot_url: string | null
  rating: number | null
  rating_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}
export const api = {
  getTemplates: () => request<Template[]>('/templates'),
  getTeams: () => request<import('@/types').Team[]>('/teams'),
  createTeam: (name: string, template: string = 'standard') =>
    request('/teams', { method: 'POST', body: JSON.stringify({ name, template }) }),
  renameTeam: (id: string, name: string) => request(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTeam: (id: string) => request(`/teams/${id}`, { method: 'DELETE' }),

  getAgents: (teamId: string) => request<import('@/types').Agent[]>(`/teams/${teamId}/agents`),
  // ── Team shared files ──────────────────────────────────────────────────
  listTeamFiles: (teamId: string) =>
    request<{ files: { name: string; size: number; modified_at: string; mime_type: string }[] }>(`/teams/${teamId}/files`),
  uploadTeamFile: async (teamId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const BASE = (process.env.NEXT_PUBLIC_SSE_BASE?.trim() || '/api')
    const res = await fetch(`${BASE}/teams/${teamId}/files`, { method: 'POST', body: form })
    if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Upload failed') }
    return res.json()
  },
  deleteTeamFile: (teamId: string, filename: string) =>
    request(`/teams/${teamId}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  getFileContent: (teamId: string, filename: string) =>
    request<{ filename: string; content: string }>(`/teams/${teamId}/files/${encodeURIComponent(filename)}/content`),
  updateFileContent: (teamId: string, filename: string, content: string) =>
    request<{ filename: string; size: number }>(`/teams/${teamId}/files/${encodeURIComponent(filename)}/content`, { method: 'PUT', body: JSON.stringify({ content }) }),
  renameTeamFile: (teamId: string, filename: string, newName: string) =>
    request(`/teams/${teamId}/files/${encodeURIComponent(filename)}/rename`, { method: 'PATCH', body: JSON.stringify({ new_name: newName }) }),
  copyTeamFile: (teamId: string, filename: string, destName: string) =>
    request(`/teams/${teamId}/files/${encodeURIComponent(filename)}/copy`, { method: 'POST', body: JSON.stringify({ dest_name: destName }) }),
  getTeamArtifacts: (teamId: string) =>
    request<{ agents: { agent_id: string; agent_name: string; folders: { folder: string; files: { name: string; path: string; size: number; modified_at: string; mime_type: string }[] }[] }[] }>(`/teams/${teamId}/artifacts`),
  deleteArtifactFile: (teamId: string, agentId: string, filePath: string) =>
    request(`/teams/${teamId}/artifacts/${agentId}/${filePath}`, { method: 'DELETE' }),

  // ── Chat channels ──────────────────────────────────────────────────────
  listChannels: (teamId: string) =>
    request<{ channels: { id: string; type: string; name: string; connected: boolean; config: Record<string, unknown>; added_at: string }[] }>(`/teams/${teamId}/channels`),
  addChannel: (teamId: string, data: { type: string; name: string; config?: Record<string, unknown> }) =>
    request(`/teams/${teamId}/channels`, { method: 'POST', body: JSON.stringify(data) }),
  updateChannelStatus: (teamId: string, channelId: string, connected: boolean) =>
    request(`/teams/${teamId}/channels/${channelId}/status`, { method: 'PATCH', body: JSON.stringify({ connected }) }),
  removeChannel: (teamId: string, channelId: string) =>
    request(`/teams/${teamId}/channels/${channelId}`, { method: 'DELETE' }),

  pairAgent: (teamId: string, agentId: string, userId: string | null) =>
    request(`/teams/${teamId}/agents/${agentId}/pair`, { method: 'PATCH', body: JSON.stringify({ user_id: userId }) }),
  getTeamMembers: (teamId: string) =>
    request<{ team_id: string; members: string[] }>(`/teams/${teamId}/members`),
  inviteMember: (teamId: string, data: { email?: string; user_id?: string }) =>
    request<{ team_id: string; members: string[]; added_user_id: string }>(`/teams/${teamId}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  createAgent: (teamId: string, data: object) => request(`/teams/${teamId}/agents`, { method: 'POST', body: JSON.stringify(data) }),
  addExpertToTeam: (teamId: string, expertId: string) =>
    request(`/teams/${teamId}/agents/from-expert`, { method: 'POST', body: JSON.stringify({ expert_id: expertId }) }),
  listExperts: () => request<{ id: string; name: string; role: string; description: string; category?: string; tags?: string[] }[]>('/experts'),
  renameAgent: (teamId: string, agentId: string, name: string) =>
    request(`/teams/${teamId}/agents/${agentId}/rename`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  startAgent: (teamId: string, agentId: string) => request(`/teams/${teamId}/agents/${agentId}/start`, { method: 'POST' }),
  stopAgent: (teamId: string, agentId: string) => request(`/teams/${teamId}/agents/${agentId}/stop`, { method: 'POST' }),
  deleteAgent: (teamId: string, agentId: string) => request(`/teams/${teamId}/agents/${agentId}`, { method: 'DELETE' }),
  agentChat: (teamId: string, agentId: string, message: string) =>
    request<{ reply: string; agent_id: string; agent_name: string }>(`/teams/${teamId}/agents/${agentId}/chat`, { method: 'POST', body: JSON.stringify({ message }) }),
  getAgentChatHistory: (teamId: string, agentId: string) =>
    request<{ history: { role: string; content: string; timestamp: string }[] }>(`/teams/${teamId}/agents/${agentId}/chat/history`),
  clearAgentChatHistory: async (teamId: string, agentId: string) => {
    const res = await fetch(`${BASE}/teams/${teamId}/agents/${agentId}/chat/history`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Request failed')
    }
  },
  getAgentFiles: (teamId: string, agentId: string) => request<import('@/types').AgentFiles>(`/teams/${teamId}/agents/${agentId}/files`),
  updateAgentFiles: (teamId: string, agentId: string, data: object) =>
    request(`/teams/${teamId}/agents/${agentId}/files`, { method: 'PUT', body: JSON.stringify(data) }),
  getAgentWorkspace: (teamId: string, agentId: string) =>
    request<{ files: import('@/types').WorkspaceEntry[] }>(`/teams/${teamId}/agents/${agentId}/workspace`),
  getWorkspaceFileUrl: (teamId: string, agentId: string, filePath: string) =>
    `/api/teams/${teamId}/agents/${agentId}/workspace/${filePath.split('/').map(encodeURIComponent).join('/')}`,
  getArtifactFileUrl: (teamId: string, agentId: string, filePath: string) =>
    `/api/teams/${teamId}/artifacts/${agentId}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
  copyArtifactToShared: (teamId: string, agentId: string, filePath: string) =>
    request<{ ok: boolean; filename: string }>(`/teams/${teamId}/artifacts/${agentId}/${filePath.split('/').map(encodeURIComponent).join('/')}/copy-to-shared`, { method: 'POST' }),

  getTasks: (params?: { team_id?: string; status?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : ''
    return request<{ tasks: import('@/types').Task[]; awaiting_decisions: number }>(`/tasks${qs ? '?' + qs : ''}`)
  },
  createTask: (data: object) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTaskStatus: (taskId: string, status: string) =>
    request(`/tasks/${taskId}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }),
  submitDecision: (taskId: string, answer: string) =>
    request(`/tasks/${taskId}/decision`, { method: 'POST', body: JSON.stringify({ answer }) }),

  getTeamNotifications: (teamId: string, to?: string, unreadBy?: string) => {
    const params = new URLSearchParams()
    if (to) params.set('to', to)
    if (unreadBy) params.set('unread_by', unreadBy)
    const qs = params.toString()
    return request<{ notifications: { id: string; from: string; to: string; subject: string; message: string; content?: { summary?: string; details?: string; files?: string[] }; type?: string; timestamp: string; read_by: string[] }[] }>(`/teams/${teamId}/notifications${qs ? '?' + qs : ''}`)
  },
  markNotificationRead: (teamId: string, notifId: string, agentName: string) =>
    request(`/teams/${teamId}/notifications/${notifId}/read?agent_name=${encodeURIComponent(agentName)}`, { method: 'POST' }),

  updateLLMConfig: (data: {
    provider: string; model: string; api_key?: string; base_url?: string;
    context_window?: number; max_tokens?: number;
    timeout_seconds?: number; llm_idle_timeout_seconds?: number;
    thinking_mode?: boolean; skip_bootstrap?: boolean;
  }) =>
    request<{ status: string; message: string }>('/settings/llm', { method: 'PUT', body: JSON.stringify(data) }),
  getLLMConfig: () =>
    request<{ llm: {
      provider?: string; model?: string; api_key_masked?: string; base_url?: string;
      context_window?: number; max_tokens?: number;
      timeout_seconds?: number; llm_idle_timeout_seconds?: number;
    thinking_mode?: boolean; skip_bootstrap?: boolean;
    } }>('/settings/llm'),
  getTeamLLMConfig: (teamId: string) =>
    request<{ llm: {
      provider?: string; model?: string; api_key_masked?: string; base_url?: string;
      context_window?: number; max_tokens?: number;
      timeout_seconds?: number; llm_idle_timeout_seconds?: number;
    thinking_mode?: boolean; skip_bootstrap?: boolean;
    }; is_override: boolean }>(`/settings/teams/${teamId}/llm`),
  updateTeamLLMConfig: (teamId: string, data: {
    provider: string; model: string; api_key?: string; base_url?: string;
    context_window?: number; max_tokens?: number;
    timeout_seconds?: number; llm_idle_timeout_seconds?: number;
    thinking_mode?: boolean; skip_bootstrap?: boolean;
  }) =>
    request<{ status: string; message: string }>(`/settings/teams/${teamId}/llm`, { method: 'PUT', body: JSON.stringify(data) }),
  resetTeamLLMConfig: (teamId: string) =>
    request<{ status: string; message: string }>(`/settings/teams/${teamId}/llm`, { method: 'DELETE' }),
  getHeartbeat: () =>
    request<{ interval: string }>('/settings/heartbeat'),
  updateHeartbeat: (interval: string) =>
    request<{ status: string; interval: string }>('/settings/heartbeat', { method: 'PUT', body: JSON.stringify({ interval }) }),
  getTeamHeartbeat: (teamId: string) =>
    request<{ interval: string; effective: string }>(`/settings/teams/${teamId}/heartbeat`),
  updateTeamHeartbeat: (teamId: string, interval: string) =>
    request<{ status: string; interval: string; effective: string }>(`/settings/teams/${teamId}/heartbeat`, { method: 'PUT', body: JSON.stringify({ interval }) }),
  getNotificationSettings: () =>
    request<{ auto_execute: boolean }>('/settings/notifications'),
  updateNotificationSettings: (autoExecute: boolean) =>
    request<{ status: string; auto_execute: boolean }>('/settings/notifications', { method: 'PUT', body: JSON.stringify({ auto_execute: autoExecute }) }),

  getUsageSummary: (teamId?: string) => {
    const qs = teamId ? `?team_id=${encodeURIComponent(teamId)}` : ''
    return request<{
      period: { start: string; end: string }
      metrics: Record<string, { used: number; quota: number; remaining: number; unlimited: boolean }>
    }>(`/usage/summary${qs}`)
  },

  masterChat: (teamId: string, message: string) =>
    request<{ reply: string; chat_id: string; dispatched: { to: string; task: string; description: string }[] }>(`/teams/${teamId}/master/chat`, { method: 'POST', body: JSON.stringify({ message }) }),
  getMasterChatHistory: (teamId: string) =>
    request<{ history: { role: string; content: string; timestamp: string }[] }>(`/teams/${teamId}/master/chat/history`),
  clearMasterChatHistory: async (teamId: string) => {
    const res = await fetch(`${BASE}/teams/${teamId}/master/chat/history`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Request failed')
    }
  },
  getUnreadCount: (teamId: string) =>
    request<{ count: number }>(`/teams/${teamId}/master/chat/unread-count`),
  markChatRead: async (teamId: string) => {
    const res = await fetch(`${BASE}/teams/${teamId}/master/chat/mark-read`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Request failed')
    }
  },
  getOpenWebUIToken: async (): Promise<string> => {
    const data = await request<{ token: string }>('/open-webui/login', { method: 'POST' })
    return data.token
  },
  getOpenWebUISession: async (): Promise<{ token: string; webui_url: string }> => {
    return request<{ token: string; webui_url: string }>('/open-webui/session')
  },
  getInternalHeartbeat: () =>
    request<{ interval: number }>('/settings/internal-heartbeat'),
  updateInternalHeartbeat: (interval: number) =>
    request<{ status: string; interval: number }>('/settings/internal-heartbeat', { method: 'PUT', body: JSON.stringify({ interval }) }),
  getAgentHeartbeat: (teamId: string, agentId: string) =>
    request<{ agent_id: string; heartbeat: string }>(`/teams/${teamId}/agents/${agentId}/heartbeat`),
  setAgentHeartbeat: (teamId: string, agentId: string, heartbeat: 'on' | 'off') =>
    request<{ agent_id: string; heartbeat: string }>(`/teams/${teamId}/agents/${agentId}/heartbeat`, { method: 'PUT', body: JSON.stringify({ heartbeat }) }),
  getOrCreateWebUIChat: (teamId: string, agentId: string) =>
    request<{ chat_id: string | null; reused: boolean }>(
      `/teams/${teamId}/agents/${agentId}/webui-chat`,
      { method: 'POST' }
    ),

  // ── Community Templates ──────────────────────────────────────────────
  listCommunityTemplates: (params?: { status?: string; type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.type) qs.set('type', params.type)
    return request<CommunityTemplateInfo[]>(`/templates?${qs.toString()}`)
  },
  getCommunityTemplate: (id: string) =>
    request<CommunityTemplateInfo>(`/templates/${encodeURIComponent(id)}`),
  createCommunityTemplate: (data: { name: string; description: string; template_type: string; content: string }) =>
    request<CommunityTemplateInfo>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  voteTemplate: (id: string, rating: number) =>
    request<CommunityTemplateInfo>(`/templates/${encodeURIComponent(id)}/vote`, { method: 'POST', body: JSON.stringify({ rating }) }),
  uploadTemplateScreenshot: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}/screenshot`, { method: 'POST', body: form })
    if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Upload failed') }
    return res.json()
  },
  getTemplateScreenshotUrl: (id: string) => `/api/templates/${encodeURIComponent(id)}/screenshot`,
  approveTemplate: (id: string) =>
    request<CommunityTemplateInfo>(`/templates/${encodeURIComponent(id)}/approve`, { method: 'PUT' }),
  rejectTemplate: (id: string, reason?: string) =>
    request<CommunityTemplateInfo>(`/templates/${encodeURIComponent(id)}/reject`, { method: 'PUT', body: JSON.stringify({ reason: reason || undefined }) }),

  // ── Per-agent LLM config ────────────────────────────────────────────────
  getAgentLLMConfig: (teamId: string, agentId: string) =>
    request<{ llm: {
      provider?: string; model?: string; api_key_masked?: string; base_url?: string;
      context_window?: number; max_tokens?: number;
      timeout_seconds?: number; llm_idle_timeout_seconds?: number;
      thinking_mode?: boolean; skip_bootstrap?: boolean;
    }; is_override: boolean; inherits_from: string }>(`/settings/teams/${teamId}/agents/${agentId}/llm`),
  updateAgentLLMConfig: (teamId: string, agentId: string, data: {
    provider: string; model: string; api_key?: string; base_url?: string;
    context_window?: number; max_tokens?: number;
    timeout_seconds?: number; llm_idle_timeout_seconds?: number;
    thinking_mode?: boolean; skip_bootstrap?: boolean;
  }) =>
    request<{ status: string; message: string }>(`/settings/teams/${teamId}/agents/${agentId}/llm`, { method: 'PUT', body: JSON.stringify(data) }),
  resetAgentLLMConfig: (teamId: string, agentId: string) =>
    request<{ status: string; message: string }>(`/settings/teams/${teamId}/agents/${agentId}/llm`, { method: 'DELETE' }),

  // ── Per-agent git credentials ──────────────────────────────────────────
  getAgentGitCredentials: (teamId: string, agentId: string) =>
    request<{ repo_url: string; username: string; pat_masked: string; is_set: boolean }>(
      `/settings/teams/${teamId}/agents/${agentId}/git`,
    ),
  updateAgentGitCredentials: (teamId: string, agentId: string, data: { repo_url?: string; username?: string; pat: string }) =>
    request<{ status: string; message: string }>(
      `/settings/teams/${teamId}/agents/${agentId}/git`,
      { method: 'PUT', body: JSON.stringify(data) },
    ),
  deleteAgentGitCredentials: (teamId: string, agentId: string) =>
    request<{ status: string; message: string }>(
      `/settings/teams/${teamId}/agents/${agentId}/git`,
      { method: 'DELETE' },
    ),
  testAgentGitCredentials: (teamId: string, agentId: string) =>
    request<{ status: 'ok' | 'auth_failed'; exit_code: number; output?: string }>(
      `/settings/teams/${teamId}/agents/${agentId}/git/test`,
      { method: 'POST' },
    ),
}
