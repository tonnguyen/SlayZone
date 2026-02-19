import { exec } from 'child_process'
import { promisify } from 'util'
import { platform, userInfo } from 'os'
import type { ValidationResult } from './adapters/types'

const execAsync = promisify(exec)

/**
 * The user's login shell, resolved from (in order):
 * 1. SHELL env var
 * 2. os.userInfo().shell — reads /etc/passwd, works even when launched from dock
 * 3. COMSPEC on Windows
 * Returns null if none can be determined.
 */
export function getDefaultShell(): string | null {
  if (process.env.SHELL) return process.env.SHELL
  if (platform() === 'win32') return process.env.COMSPEC || null
  try { return userInfo().shell || null } catch { return null }
}

let cachedShellPath: string | null = null

/**
 * Get the user's login shell PATH (handles nvm, homebrew, etc.).
 * Electron launched from the dock inherits a minimal PATH — this resolves
 * the full PATH by running a login shell once and caching the result.
 */
export async function getUserShellPath(): Promise<string> {
  if (cachedShellPath !== null) return cachedShellPath
  try {
    const shell = getDefaultShell()
    if (!shell) throw new Error('Could not determine user shell')
    const isFish = shell.endsWith('/fish') || shell === 'fish'
    const isBashOrZsh = /\/(bash|zsh)$/.test(shell)
    if (!isFish && !isBashOrZsh) {
      cachedShellPath = process.env.PATH || ''
      return cachedShellPath
    }
    // Fish: use -i (interactive) so config guarded by `status is-interactive` runs.
    // bash/zsh: use -l (login) so .bash_profile/.zprofile runs.
    const cmd = isFish
      ? `${shell} -i -c 'string join ":" $PATH'`
      : `${shell} -l -c 'echo $PATH'`
    const { stdout } = await execAsync(cmd, { timeout: 3000 })
    // Take last line: fish may print fish_greeting before the PATH output
    cachedShellPath = stdout.trim().split('\n').at(-1) ?? ''
  } catch {
    cachedShellPath = process.env.PATH || ''
  }
  return cachedShellPath
}

/**
 * Check if the user's shell is supported for PATH enrichment.
 * Returns a ValidationResult for use in adapter Doctor checks.
 */
export function validateShellEnv(): ValidationResult {
  const shell = getDefaultShell()
  if (!shell) {
    return {
      check: 'Shell detected',
      ok: false,
      detail: 'No shell detected — SHELL env var is not set',
      fix: 'export SHELL=/bin/zsh  (or bash, fish)'
    }
  }
  const isFish = shell.endsWith('/fish') || shell === 'fish'
  const isBashOrZsh = /\/(bash|zsh)$/.test(shell)
  if (!isFish && !isBashOrZsh) {
    return {
      check: 'Shell detected',
      ok: false,
      detail: `Unsupported shell: ${shell} — PATH enrichment disabled`,
      fix: 'Set SHELL to bash, zsh, or fish in your environment'
    }
  }
  return { check: 'Shell detected', ok: true, detail: shell }
}

/**
 * Find a binary by name using the enriched login shell PATH.
 * Returns the resolved path or null if not found.
 */
export async function whichBinary(name: string): Promise<string | null> {
  try {
    const shellPath = await getUserShellPath()
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`
    const { stdout } = await execAsync(cmd, {
      env: { ...process.env, PATH: shellPath },
      timeout: 3000
    })
    const found = stdout.trim().split('\n')[0]
    return found || null
  } catch {
    return null
  }
}
