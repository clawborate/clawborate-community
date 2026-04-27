const en = {
  nav: { teams: 'Teams', tasks: 'Tasks' },
  teams: {
    title: 'My Teams', subtitle: 'Manage your AI Agent teams',
    newTeam: '+ New Team', openTeam: 'Open Team →', rename: 'Rename', delete: 'Delete',
    createModal: {
      title: 'Create New Team', label: 'Team Name', placeholder: 'e.g. "Product Team"',
      hint: 'A Master Agent and 3 default Sub-Agents will be created automatically.', cancel: 'Cancel', submit: 'Create Team',
      stepChooseTemplate: 'Choose Template', stepNameTeam: 'Name Your Team',
      templateSubtitle: 'Select a starting configuration for your team.',
      tplLeanName: 'Lean Team', tplLeanAgents: '1 Master + 1 Sub-Agent', tplLeanDesc: 'Best for focused, single-purpose tasks.',
      tplStdName: 'Standard Team', tplStdAgents: '1 Master + 3 Sub-Agents', tplStdDesc: 'Designer · Developer · Tester — ideal for full product workflows.',
      back: '← Back',
    },
    renameModal: { title: 'Rename Team', label: 'Team Name', cancel: 'Cancel', submit: 'Save' },
    deleteModal: { title: '⚠️ Delete Team', cancel: 'Cancel', submit: 'Delete Team', bullet1: 'Master Agent container', bullet3: 'Sub-Agent containers', bullet4: 'All task history', irreversible: '(irreversible)' },
    needAction: 'need action', master: 'Master', subAgents: 'Sub Agents', newTask: '+ New Task',
    loading: 'Setting up your first team...', loadingHint: 'Master Agent and 3 Sub-Agents are starting',
  },
  agents: { title: 'Agents', newAgent: '+ New Agent', back: '← Back', start: 'Start', stop: 'Stop', restart: 'Restart', recreate: 'Recreate', delete: 'Delete', console: 'Console', save: 'Save Changes', identity: 'IDENTITY', soul: 'SOUL', memory: 'MEMORY', chat: 'Chat' },
  tasks: { title: 'Tasks', newTask: '+ New Task', all: 'All', pending: 'Pending', inProgress: 'In Progress', completed: 'Completed', failed: 'Failed', awaitingDecision: 'Awaiting Decision', submitDecision: 'Submit Decision', assignTo: 'Assign to', priority: 'Priority', description: 'Description' },
  status: { running: 'running', stopped: 'stopped', exited: 'exited', dead: 'dead', starting: 'starting' },
  common: { cancel: 'Cancel', save: 'Save', confirm: 'Confirm', loading: 'Loading...' },
  chat: { title: 'Master Agent', placeholder: 'Message Master Agent...', clear: 'Clear', clearConfirm: 'Clear all chat history?', clearBtn: 'Clear', cancelBtn: 'Cancel', empty: 'No messages yet', emptyHint: 'Send a message to start', taskCreated: 'Task created', unreadPill: 'new', unreadDivider: '── New messages below ──' },
  settings: { agents: 'Agents', heartbeatFrequency: 'Heartbeat Frequency', heartbeatDesc: 'How often agents automatically check for new tasks.', saved: '✓ Saved', off: 'Off', globalPrefix: 'Global' },
  teamDetail: {
    tabAgents: 'Agents', tabConfig: 'Config',
    dangerZone: 'Danger Zone',
    dangerDesc: 'Deleting this team is irreversible. All containers, agents, and task history will be permanently removed.',
    deleteTeam: 'Delete Team',
    deleteModal: {
      title: '⚠️ Delete Team',
      description: 'This action cannot be undone. Type the exact team name below to confirm:',
      inputPlaceholder: 'Team name',
      confirm: 'Confirm Delete',
      deleting: 'Deleting…',
      cancel: 'Cancel',
      activeTasks: (n: number) => `${n} active task${n > 1 ? 's' : ''} will be terminated.`,
    },
  },
}

export default en
export type Translations = typeof en
