# Category 3: Agent Orchestrators / Vibe Coding (closest competitors)

## Tier A: Direct Competitors (kanban/task + agents + desktop-ish)

| Tool | Type | Price | Stars | Multi-Provider | Kanban | Worktrees | Terminal | Browser | Editor | DB | License |
|------|------|-------|-------|----------------|--------|-----------|----------|---------|--------|-----|---------|
| **VibeKanban** | Web app (Rust server + React in browser via `npx`) | Free / $30 Pro / Enterprise | 22k | Yes (10+ agents: Claude, Codex, Amp, Gemini, Copilot, Cursor, OpenCode, Droid, Qwen, ACP) | Yes | Yes | Yes (xterm.js → backend) | Partial (dev preview) | Partial (CodeMirror for review) | PostgreSQL | Apache 2.0 |
| **Superset** (superset-sh) | Electron desktop | Free (ELv2) | 2k | Yes (Claude, Codex, Gemini, Cursor, OpenCode, Copilot) | No | Yes | Yes (xterm.js) | Yes (inline preview) | Yes (Monaco) | SQLite + Electric SQL | Elastic v2 |
| **Conductor** | macOS native (closed) | Free (YC seed-funded) | N/A | Partial (Claude Code + Codex) | No | Yes | Agent output only | No | File explorer | N/A | Proprietary |
| **AutoMaker** | Electron desktop | Free | 3k | Partial (Claude + Codex + Copilot SDKs) | Yes | Yes | Yes (xterm.js + node-pty) | No | Yes (CodeMirror) | JSON files | MIT |
| **Maestro** | Electron desktop | Free | 2.3k | Yes (Claude, Codex, OpenCode, Droid) | No | Yes | Yes (node-pty, real PTY) | No | File explorer | SQLite | AGPL-3.0 |
| **AutoClaude** | Web UI (localhost) | Free (needs Claude sub) | ~500 | No (Claude only) | Yes | No | Yes (12 parallel) | No | No | N/A | MIT |

## Tier B: Orchestration Engines (headless / no visual task mgmt)

| Tool | Type | Price | Stars | Multi-Provider | Worktrees | Key Differentiator | License |
|------|------|-------|-------|----------------|-----------|-------------------|---------|
| **Zeroshot** (covibes) | CLI (Node.js + Rust TUI WIP) | Free | 1.2k | Yes (Claude, Codex, Gemini, OpenCode) | Yes (+ Docker) | Plan→implement→blind-validate loop. Issue integrations (GH/GL/Jira/Azure) | MIT |
| **AGOR** (preset-io) | Web app (FeathersJS + React) | Free (BSL 1.1) | 1k | Yes (Claude, Codex, Gemini, OpenCode) | Yes | Figma-like spatial canvas. Zone triggers for workflow automation. By Airflow/Superset creator | BSL 1.1 |
| **Hephaestus** | Python backend + React dashboard | Free | 1.1k | Yes (OpenAI, Anthropic, Google, Groq) | Yes | Semi-structured workflows — agents create tasks dynamically. Guardian validation. Qdrant RAG | AGPL-3.0 |
| **Devin** | Cloud platform | $20/mo Ind, $500/mo Team | N/A | No (Cognition models) | Yes (branches) | Fully autonomous cloud SWE agent | Proprietary |
| **OpenHands** | Web + CLI + SDK | Free (MIT) | ~10k | Yes (any LLM) | No | Scale to 1000s of cloud agents via Python SDK | MIT |
| **SWE-agent** | CLI/Docker | Free | ~15k | Yes (any LLM) | No | Academic benchmark leader (SWE-bench). NeurIPS 2024 paper | MIT |
| **TaskMaster AI** | CLI + MCP server | Free | 15k | Yes (Claude, OpenAI, Perplexity) | No | PRD→task-tree with dependencies. MCP server for IDE integration | MIT+Commons |
| **Sweep AI** | JetBrains plugin | $10-60/mo | ~3k | Limited | No | GitHub issue→PR automation | OSS |

## Tier C: App Builders (different category)

| Tool | Type | Price | Notes |
|------|------|-------|-------|
| **bolt.new** | Web app | Free-$200/mo | Prompt→full-stack app. Not task management |
| **v0.dev** | Web app | Free-$20/mo | Prompt→React/Next.js UI. Not task management |

## Key Competitive Analysis

**VibeKanban** (22k stars, Apache 2.0) is the #1 competitor by traction. Key differences:
- Web app in browser (Rust server + `npx`), NOT native desktop. No system tray, no native hotkeys
- PostgreSQL (heavier), not SQLite (simpler)
- No embedded browser per task, no full editor panel
- Stronger: 10+ agent integrations, built-in diff/merge/PR workflow, remote/SSH, team/cloud variant
- $30/mo Pro for teams

**Superset** (superset-sh, 2k stars, ELv2) is the closest architectural match — also Electron + xterm.js + Monaco + SQLite + browser pane + worktrees. Key differences:
- No kanban / task management (it's a terminal multiplexer, not a PM tool)
- ELv2 license (not truly OSS — can't offer as hosted service)
- Electric SQL for cloud sync (vs pure local SQLite)
- Just hit v1.0 today. Very new (4 months old)

**Conductor** (YC-backed, closed source, macOS-only) is well-funded but narrow:
- Claude Code + Codex only (2 providers)
- No kanban, no embedded browser, no multi-project
- macOS-only, closed source
- Linear integration is nice

**Maestro** (2.3k stars, AGPL) is a power-user agent launcher:
- Playbook-based batch processing, group chat, mobile remote control
- No kanban, no task management — purely agent orchestration
- real PTY terminals like SlayZone

**AutoMaker** (3k stars, MIT) has the closest feature set (kanban + Electron + worktrees + terminal + editor):
- **BUT: "no longer actively maintained"** per README/LICENSE
- JSON file storage (no DB), Claude SDK primary, limited multi-provider
- Good reference for what the market wants

**Zeroshot** (1.2k stars, MIT) is an impressive CLI orchestrator:
- Blind-validate loop is unique (validator never sees worker's context)
- Issue integrations (GitHub, GitLab, Jira, Azure DevOps)
- No UI at all (TUI in progress). Headless execution engine

**AGOR** (1k stars, BSL 1.1) has the most creative UI concept:
- Figma-like spatial canvas with "zone triggers"
- By the creator of Apache Airflow + Apache Superset (Maxime Beauchemin)
- BSL license = not truly open source (production use requires commercial license)
- Essentially a solo project

**Hephaestus** (1.1k stars, AGPL) is the most research-oriented:
- Agents dynamically create tasks (semi-structured workflows)
- Guardian oversight agent for validation
- Alpha, 62 commits, possibly stale (last commit 3 months ago)
