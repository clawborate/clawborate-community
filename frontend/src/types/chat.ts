export interface DispatchedTask {
  to: string
  task: string
  description?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'master' | 'agent'
  type?: 'notification'        // renders as NotifCard instead of chat bubble
  requiresLlm?: boolean        // show Authorize button when auto_execute=false
  content: string
  timestamp: string
  dispatched?: DispatchedTask[]
  isError?: boolean
  agentName?: string   // sub-agent messages surfaced in MasterChat
  images?: string[]    // base64 data URLs for user messages with attachments
}
