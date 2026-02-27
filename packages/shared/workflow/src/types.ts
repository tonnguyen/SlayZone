export const WORKFLOW_CATEGORIES = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled'
] as const

export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number]

export interface ColumnConfig {
  id: string
  label: string
  color: string
  position: number
  category: WorkflowCategory
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'inbox', label: 'Inbox', color: 'gray', position: 0, category: 'triage' },
  { id: 'backlog', label: 'Backlog', color: 'slate', position: 1, category: 'backlog' },
  { id: 'todo', label: 'Todo', color: 'blue', position: 2, category: 'unstarted' },
  { id: 'in_progress', label: 'In Progress', color: 'yellow', position: 3, category: 'started' },
  { id: 'review', label: 'Review', color: 'purple', position: 4, category: 'started' },
  { id: 'done', label: 'Done', color: 'green', position: 5, category: 'completed' },
  { id: 'canceled', label: 'Canceled', color: 'slate', position: 6, category: 'canceled' }
]
