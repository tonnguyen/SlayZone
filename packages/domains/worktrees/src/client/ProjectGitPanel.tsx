import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { GitDiffPanel } from './GitDiffPanel'

interface ProjectGitPanelProps {
  projectPath: string | null
  visible: boolean
}

export function ProjectGitPanel({ projectPath, visible }: ProjectGitPanelProps) {
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath || !visible) return
    window.api.git.getCurrentBranch(projectPath).then(setBranch).catch(() => setBranch(null))
  }, [projectPath, visible])

  return (
    <div className="flex flex-col h-full min-h-0">
      {branch && (
        <div className="shrink-0 h-8 px-3 border-b border-border flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="size-3.5" />
          <span className="font-mono">{branch}</span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <GitDiffPanel
          task={null}
          projectPath={projectPath}
          visible={visible}
        />
      </div>
    </div>
  )
}
