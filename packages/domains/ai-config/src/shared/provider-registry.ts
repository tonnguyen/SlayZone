import type { CliProvider, McpTarget, ProviderPathMapping } from './types'

export const PROVIDER_PATHS: Record<CliProvider, ProviderPathMapping> = {
  claude: {
    rootInstructions: 'CLAUDE.md',
    skillsDir: '.claude/skills',
    commandsDir: '.claude/commands',
  },
  codex: {
    rootInstructions: 'AGENTS.md',
    skillsDir: '.agents/skills',
    commandsDir: null,
  },
  cursor: {
    rootInstructions: 'AGENTS.md',
    skillsDir: '.cursor/skills',
    commandsDir: null,
  },
  gemini: {
    rootInstructions: 'GEMINI.md',
    skillsDir: '.gemini/skills',
    commandsDir: null,
  },
  opencode: {
    rootInstructions: 'OPENCODE.md',
    skillsDir: 'skill',
    commandsDir: null,
  },
}

export interface GlobalProviderPaths {
  label: string
  baseDir: string        // relative to $HOME
  instructions?: string  // relative to baseDir
  skillsDir?: string     // relative to baseDir
  commandsDir?: string   // relative to baseDir
}

export const GLOBAL_PROVIDER_PATHS: Record<string, GlobalProviderPaths> = {
  claude:   { label: 'Claude Code', baseDir: '.claude', instructions: 'CLAUDE.md' },
  codex:    { label: 'Codex',       baseDir: '.codex',  instructions: 'AGENTS.md' },
  gemini:   { label: 'Gemini',      baseDir: '.gemini', instructions: 'GEMINI.md', skillsDir: 'skills', commandsDir: 'commands' },
  opencode: { label: 'OpenCode',    baseDir: '.config/opencode', instructions: 'AGENTS.md', skillsDir: 'skills', commandsDir: 'commands' },
}

export const PROVIDER_LABELS: Record<CliProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor Agent',
  gemini: 'Gemini',
  opencode: 'OpenCode',
}

export interface ProviderCapabilities {
  configurable: boolean
  mcpReadable: boolean
  mcpWritable: boolean
}

export const PROVIDER_CAPABILITIES: Record<CliProvider, ProviderCapabilities> = {
  claude: { configurable: true, mcpReadable: true, mcpWritable: true },
  codex: { configurable: true, mcpReadable: false, mcpWritable: false },
  cursor: { configurable: true, mcpReadable: true, mcpWritable: true },
  gemini: { configurable: true, mcpReadable: true, mcpWritable: false },
  opencode: { configurable: true, mcpReadable: true, mcpWritable: false },
}

export interface McpTargetCapabilities {
  configurable: boolean
  writable: boolean
}

export const MCP_TARGET_CAPABILITIES: Record<McpTarget, McpTargetCapabilities> = {
  claude: { configurable: PROVIDER_CAPABILITIES.claude.mcpReadable, writable: PROVIDER_CAPABILITIES.claude.mcpWritable },
  codex: { configurable: PROVIDER_CAPABILITIES.codex.mcpReadable, writable: PROVIDER_CAPABILITIES.codex.mcpWritable },
  cursor: { configurable: PROVIDER_CAPABILITIES.cursor.mcpReadable, writable: PROVIDER_CAPABILITIES.cursor.mcpWritable },
  gemini: { configurable: PROVIDER_CAPABILITIES.gemini.mcpReadable, writable: PROVIDER_CAPABILITIES.gemini.mcpWritable },
  opencode: { configurable: PROVIDER_CAPABILITIES.opencode.mcpReadable, writable: PROVIDER_CAPABILITIES.opencode.mcpWritable },
}

const MCP_TARGET_ORDER: McpTarget[] = ['claude', 'codex', 'cursor', 'gemini', 'opencode']

export function isConfigurableCliProvider(provider: string): provider is CliProvider {
  if (!Object.hasOwn(PROVIDER_CAPABILITIES, provider)) return false
  return PROVIDER_CAPABILITIES[provider as CliProvider].configurable
}

export function filterConfigurableCliProviders(providers: readonly string[]): CliProvider[] {
  const filtered: CliProvider[] = []
  for (const provider of providers) {
    if (!isConfigurableCliProvider(provider)) continue
    if (!filtered.includes(provider)) filtered.push(provider)
  }
  return filtered
}

export function isConfigurableMcpTarget(target: string): target is McpTarget {
  if (!Object.hasOwn(MCP_TARGET_CAPABILITIES, target)) return false
  return MCP_TARGET_CAPABILITIES[target as McpTarget].configurable
}

export function getConfigurableMcpTargets(opts?: { writableOnly?: boolean }): McpTarget[] {
  const writableOnly = opts?.writableOnly ?? false
  return MCP_TARGET_ORDER.filter((target) => {
    const cap = MCP_TARGET_CAPABILITIES[target]
    if (!cap.configurable) return false
    if (writableOnly && !cap.writable) return false
    return true
  })
}
