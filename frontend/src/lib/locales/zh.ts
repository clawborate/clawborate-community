import type { Translations } from './en'

const zh: Translations = {
  nav: { teams: '团队', tasks: '任务' },
  teams: {
    title: '我的团队', subtitle: '管理你的 AI Agent 团队',
    newTeam: '+ 新建团队', openTeam: '进入团队 →', rename: '重命名', delete: '删除',
    createModal: {
      title: '新建团队', label: '团队名称', placeholder: '例如："产品团队"',
      hint: '将自动创建 1 个 Master Agent 和 3 个默认 Sub-Agent。', cancel: '取消', submit: '创建团队',
      stepChooseTemplate: '选择模板', stepNameTeam: '命名团队',
      templateSubtitle: '为你的团队选择初始配置。',
      tplLeanName: '精简团队', tplLeanAgents: '1 Master + 1 Sub-Agent', tplLeanDesc: '适合专注的单一任务。',
      tplStdName: '标准团队', tplStdAgents: '1 Master + 3 Sub-Agent', tplStdDesc: 'Designer · Developer · Tester — 适合完整产品开发流程。',
      back: '← 返回',
    },
    renameModal: { title: '重命名团队', label: '团队名称', cancel: '取消', submit: '保存' },
    deleteModal: { title: '⚠️ 删除团队', cancel: '取消', submit: '删除团队', bullet1: 'Master Agent 容器', bullet3: '个 Sub-Agent 容器', bullet4: '所有任务历史', irreversible: '（不可恢复）' },
    needAction: '需要处理', master: 'Master', subAgents: 'Sub Agent', newTask: '+ 新建任务',
    loading: '正在初始化你的第一个团队...', loadingHint: 'Master Agent 和 3 个 Sub-Agent 正在启动',
  },
  agents: { title: 'Agent 列表', newAgent: '+ 新增 Agent', back: '← 返回', start: '启动', stop: '停止', restart: '重启', recreate: '重新创建', delete: '删除', console: '控制台', save: '保存修改', identity: '身份', soul: '性格', memory: '记忆', chat: '聊天' },
  tasks: { title: '任务', newTask: '+ 新建任务', all: '全部', pending: '待处理', inProgress: '进行中', completed: '已完成', failed: '失败', awaitingDecision: '等待决策', submitDecision: '提交决策', assignTo: '指派给', priority: '优先级', description: '描述' },
  status: { running: '运行中', stopped: '已停止', exited: '已退出', dead: '已损坏', starting: '启动中' },
  common: { cancel: '取消', save: '保存', confirm: '确认', loading: '加载中...' },
  chat: { title: 'Master Agent', placeholder: '发消息给 Master Agent...', clear: '清除记录', clearConfirm: '确定清除所有聊天记录？', clearBtn: '清除', cancelBtn: '取消', empty: '暂无消息', emptyHint: '发送消息开始对话', taskCreated: '任务已创建', unreadPill: '条新消息', unreadDivider: '── 以下为新消息 ──' },
  settings: { agents: 'Agents', heartbeatFrequency: '心跳频率', heartbeatDesc: 'agents 自动检查新任务的频率。', saved: '✓ 已保存', off: '关闭', globalPrefix: '全局' },
  teamDetail: {
    tabAgents: 'Agents', tabConfig: '团队配置',
    dangerZone: '危险操作',
    dangerDesc: '删除团队是不可逆的操作，所有容器、Agent 及任务历史将被永久移除。',
    deleteTeam: '删除团队',
    deleteModal: {
      title: '⚠️ 删除团队',
      description: '此操作不可恢复。请在下方精确输入团队名称以确认：',
      inputPlaceholder: '团队名称',
      confirm: '确认删除',
      deleting: '删除中…',
      cancel: '取消',
      activeTasks: (n: number) => `${n} 个进行中的任务将被终止。`,
    },
  },
}

export default zh
