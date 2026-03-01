# Category 1: AI Coding IDEs (editor-first, agents bolted on)

| Tool | Type | Price | Multi-Provider | Task Mgmt | Terminal | Kanban | OSS | Desktop |
|------|------|-------|----------------|-----------|----------|--------|-----|---------|
| **Cursor** | VS Code fork | $20/mo Pro, $32 Teams, $200 Ultra | Yes (OpenAI, Anthropic, Gemini, xAI) | No built-in | Integrated + Background Agents (cloud VMs) | No | No | Yes (Electron) |
| **Windsurf** | VS Code fork | $15/mo Pro, $30 Teams, $60 Enterprise | Limited (own SWE models + GPT/Claude via credits) | No built-in | Cascade runs terminal cmds | No | No | Yes (Electron) |
| **Zed** | Native editor (Rust) | Free + $10/mo Pro (token-based) | Yes (20+ providers, BYOK) | No | Integrated | No | Yes (GPL) | Yes (native) |
| **GitHub Copilot** | IDE extension | $10/mo Individual, $19/mo Business | Yes (GPT, Claude, Gemini) | Via GitHub Projects/Issues | Via IDE | Via GitHub Projects | No | N/A (extension) |
| **JetBrains AI** | IDE plugin (Junie agent) | $10/mo Pro, $30/mo Ultimate | Yes (Google, OpenAI, Anthropic, local) | No built-in | Integrated (JetBrains) | No | No | Yes (JetBrains IDEs) |
| **Continue.dev** | IDE extension | Free OSS + $10/mo Hub Team | Yes (20+ providers, BYOK) | No built-in | CLI tool (`cn`) | No | Yes (Apache 2.0) | N/A (extension) |
| **Augment Code** | Extension + CLI + Web | Free, $50 Dev, $100 Pro, $250 Max | Partial (own models; Context Engine MCP for Cursor/Claude) | Yes (Intent task lists, coordinator agent) | Yes (Auggie CLI, agents run commands) | No | No | N/A (ext/web) |
| **Cline** | VS Code extension | Free (BYOK) | Yes (any OpenAI-compatible) | No | Via VS Code | No | Yes (Apache 2.0) | N/A (extension) |
| **Roo Code** | VS Code extension (Cline fork) | Free (BYOK) | Yes (any provider) | No | Via VS Code | No | Yes | N/A (extension) |
| **Amazon Q Developer** | IDE ext + CLI | Free tier, $19/mo Pro | No (AWS models only) | No | CLI agent | No | Yes (CLI is OSS) | N/A (ext/CLI) |

## Key gap vs SlayZone
None of these have kanban/task management. They're editors with AI chat — you still need a separate PM tool. SlayZone is the inverse: task board first, terminals + agents per card.
