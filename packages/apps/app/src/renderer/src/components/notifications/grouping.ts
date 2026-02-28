import { buildStatusOptions } from '@slayzone/ui'
import type { Project } from '@slayzone/projects/shared'
import type { AttentionTask } from './useAttentionTasks'

export interface GroupedAttentionTasks {
  status: string
  label: string
  tasks: AttentionTask[]
}

export function groupAttentionTasksByStatus(
  attentionTasks: AttentionTask[],
  projects: Project[],
  filterCurrentProject: boolean,
  selectedProjectId: string
): GroupedAttentionTasks[] {
  const groups = new Map<string, {
    tasks: AttentionTask[]
    minOrder: number
    labelCounts: Map<string, number>
  }>()
  const projectStatusOptionsById = new Map(
    projects.map((project) => [project.id, buildStatusOptions(project.columns_config)])
  )
  const currentProjectOptions = selectedProjectId
    ? (projectStatusOptionsById.get(selectedProjectId) ?? buildStatusOptions(null))
    : buildStatusOptions(null)

  for (const item of attentionTasks) {
    const status = item.task.status
    const options = filterCurrentProject
      ? currentProjectOptions
      : (projectStatusOptionsById.get(item.task.project_id) ?? buildStatusOptions(null))
    const optionIndex = options.findIndex((option) => option.value === status)
    const label = optionIndex >= 0 ? options[optionIndex].label : status
    const order = optionIndex >= 0 ? optionIndex : Number.MAX_SAFE_INTEGER
    const existing = groups.get(status) ?? {
      tasks: [],
      minOrder: Number.MAX_SAFE_INTEGER,
      labelCounts: new Map<string, number>()
    }
    existing.tasks.push(item)
    existing.minOrder = Math.min(existing.minOrder, order)
    existing.labelCounts.set(label, (existing.labelCounts.get(label) ?? 0) + 1)
    groups.set(status, existing)
  }

  return [...groups.entries()]
    .map(([status, group]) => {
      const label =
        [...group.labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? status
      return {
        status,
        label,
        tasks: group.tasks,
        order: group.minOrder
      }
    })
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label)
    })
}
