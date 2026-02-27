import type { ColumnConfig } from '@slayzone/workflow'

export {
  WORKFLOW_CATEGORIES,
  DEFAULT_COLUMNS,
  type WorkflowCategory,
  type ColumnConfig
} from '@slayzone/workflow'

export interface Project {
  id: string
  name: string
  color: string
  path: string | null
  auto_create_worktree_on_task_create: number | null
  columns_config: ColumnConfig[] | null
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  color: string
  path?: string
  columnsConfig?: ColumnConfig[]
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
  path?: string | null
  autoCreateWorktreeOnTaskCreate?: boolean | null
  columnsConfig?: ColumnConfig[] | null
}
