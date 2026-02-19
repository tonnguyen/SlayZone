import type { TerminalAdapter, SpawnConfig, PromptInfo, CodeMode, ActivityState, ErrorInfo } from './types'
import { getDefaultShell } from '../shell-env'

/**
 * Adapter for raw terminal/shell.
 * Passthrough with no special parsing or prompt detection.
 */
export class ShellAdapter implements TerminalAdapter {
  readonly mode = 'terminal' as const
  readonly idleTimeoutMs = null // use default 60s

  buildSpawnConfig(_cwd: string, _conversationId?: string, _resuming?: boolean, _initialPrompt?: string, _providerArgs?: string[], _codeMode?: CodeMode): SpawnConfig {
    return {
      shell: getDefaultShell() ?? '/bin/sh',
      args: []
    }
  }

  detectActivity(_data: string, _current: ActivityState): ActivityState | null {
    // Raw terminal has no activity detection
    return null
  }

  detectError(_data: string): ErrorInfo | null {
    // Raw terminal has no error detection
    return null
  }

  detectPrompt(_data: string): PromptInfo | null {
    // Raw terminal has no prompt detection
    return null
  }
}
