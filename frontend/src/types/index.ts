export type AgentStatus = 'running' | 'stopped' | 'exited' | 'dead' | 'starting'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_decision'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  container_id?: string
  team_id: string
  is_master: boolean
  score: number
  current_task?: string
}

export interface Team {
  id: string
  name: string
  master?: Agent
  sub_agents: Agent[]
  pending_decisions: number
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigned_agent_id?: string
  assigned_agent_name?: string
  team_id: string
  created_at: string
  updated_at: string
  decision_question?: string
  decision_options?: string[]
}

export interface AgentFiles {
  identity: string
  soul: string
  memory: string
}

export interface WorkspaceEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number
  modified_at?: string
  children?: WorkspaceEntry[]
}
