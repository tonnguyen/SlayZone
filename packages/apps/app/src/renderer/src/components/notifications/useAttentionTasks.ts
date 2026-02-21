import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PtyInfo } from '@slayzone/terminal/shared'
import type { Task } from '@slayzone/task/shared'

export interface AttentionTask {
  task: Task
  sessionId: string
  lastOutputTime: number
}

interface UseAttentionTasksResult {
  attentionTasks: AttentionTask[]
  count: number
  refresh: () => Promise<void>
}

export function buildAttentionTasks(
  ptys: PtyInfo[],
  tasks: Task[],
  filterProjectId: string | null
): AttentionTask[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const byTaskId = new Map<string, AttentionTask>()

  for (const pty of ptys) {
    const task = tasksById.get(pty.taskId)
    if (!task) continue
    if (filterProjectId && task.project_id !== filterProjectId) continue

    const current = byTaskId.get(pty.taskId)
    if (!current || pty.lastOutputTime > current.lastOutputTime) {
      byTaskId.set(pty.taskId, {
        task,
        sessionId: pty.sessionId,
        lastOutputTime: pty.lastOutputTime
      })
    }
  }

  return [...byTaskId.values()]
}

export function useAttentionTasks(
  tasks: Task[],
  filterProjectId: string | null
): UseAttentionTasksResult {
  const [ptys, setPtys] = useState<PtyInfo[]>([])

  const refresh = useCallback(async () => {
    const list = await window.api.pty.list()
    setPtys(list.filter((p) => p.state === 'attention'))
  }, [])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh on attention/state-change events
  useEffect(() => {
    const unsubAttention = window.api.pty.onAttention(() => refresh())
    const unsubStateChange = window.api.pty.onStateChange(() => refresh())
    return () => {
      unsubAttention()
      unsubStateChange()
    }
  }, [refresh])

  // Build a unique list (one row per task), keeping the most recent attention session.
  const attentionTasks: AttentionTask[] = useMemo(
    () => buildAttentionTasks(ptys, tasks, filterProjectId),
    [ptys, tasks, filterProjectId]
  )

  return {
    attentionTasks,
    count: attentionTasks.length,
    refresh
  }
}
