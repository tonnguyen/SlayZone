# Category 2: AI CLI Agents (terminal-first, no visual UI)

| Tool | Type | Price | Multi-Provider | Task Mgmt | Visual UI | Kanban | OSS |
|------|------|-------|----------------|-----------|-----------|--------|-----|
| **Claude Code** | CLI | $20/mo Pro, $100-200/mo Max, or API BYOK | No (Anthropic only) | Minimal (/task subagents) | No | No | No (proprietary) |
| **OpenAI Codex** | CLI (Rust) + Cloud | $20/mo Plus, $200/mo Pro, or API | No (OpenAI only) | Cloud task dashboard | No (cloud has task list) | No | CLI: Yes |
| **Gemini CLI** | CLI | Free (1000 req/day!), $20/mo Pro, $150/mo Ultra | No (Google only) | No | No | No | Yes |
| **Aider** | CLI (Python) | Free (BYOK) | Yes (100+ LLMs) | No | No (TUI only) | No | Yes (Apache 2.0) |

## Key gap vs SlayZone
All headless. No visual task tracking, no kanban, no embedded browser, no git worktree isolation per task. SlayZone wraps these agents in a visual layer with per-task terminals and context.
