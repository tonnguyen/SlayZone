# Positioning & Competitive Narratives

## Positioning Matrix

```
                    Agent-first
                        │
         Devin          │     Maestro, Zeroshot
       Hephaestus       │     (agent launchers)
                        │
   Editor-first ────────┼──────── Task-first
                        │
     Cursor/Zed         │     SlayZone, VibeKanban
    Superset.sh         │     AutoMaker, AGOR
   (IDE/terminal)       │   (kanban + agents)
                        │
                    Linear/Jira
                    (PM, no agents)
```

## Key Competitive Narratives

1. **vs VibeKanban** (#1 threat, 22k stars): "Runs in a browser tab, needs PostgreSQL. SlayZone is a native desktop app with real PTY terminals, embedded browser per task, and local-first SQLite. No server to manage."
2. **vs Superset.sh** (closest arch match): "Great terminal multiplexer, but no kanban or task management. SlayZone is task-first — every card is a dev environment, not just a terminal tab."
3. **vs Conductor** (YC-backed): "macOS-only, closed source, only Claude+Codex. No kanban, no embedded browser. SlayZone is cross-platform, multi-provider, with full task management."
4. **vs Maestro**: "Powerful agent launcher with playbooks, but no task management or kanban. SlayZone gives you the board view to organize and track, not just run."
5. **vs Cursor/Windsurf/Zed**: "You still need Linear for task tracking. SlayZone = task board with the agent already running in each card."
6. **vs Devin**: "Cloud-only, $500/mo for teams, single provider. SlayZone runs YOUR agents locally, any provider, free (BYOK)."
7. **vs Linear/Jira**: "Great for teams, but your AI agent can't run inside a Linear ticket. In SlayZone, every card IS a dev environment."
8. **vs AutoMaker**: "Unmaintained. Similar vision but JSON file storage, limited providers, no embedded browser. SlayZone is actively developed with SQLite and full multi-provider support."
9. **vs AGOR**: "Creative spatial canvas but BSL license (not truly OSS), needs commercial license for production, solo maintainer."
10. **vs Zeroshot**: "Headless CLI engine — great for CI/CD pipelines but no visual interface. SlayZone wraps your agents in a kanban board."
11. **vs Claude Code / Codex CLI**: "SlayZone doesn't replace these — it's the cockpit that orchestrates them across parallel tasks."

## 2026 Landscape Trends

1. **Orchestrator explosion.** In 4 months (Oct 2025–Feb 2026), at least 8 agent orchestrators launched: VibeKanban, Superset.sh, Conductor, Maestro, AutoMaker, Zeroshot, AGOR, Hephaestus. This is the hottest category right now.
2. **Kanban + agents = the winning combo.** VibeKanban (22k stars) and AutoMaker (3k stars) both validated that developers want kanban boards with agent integration. But AutoMaker is already unmaintained — execution matters.
3. **Multi-agent is table stakes.** Every tool supports 3+ agent providers. The moat is in UX, not agent support.
4. **Git worktrees are standard.** Every serious orchestrator uses worktrees for isolation. Not a differentiator anymore — it's expected.
5. **License fragmentation.** Apache 2.0 (VibeKanban), MIT (Zeroshot, AutoMaker), AGPL (Maestro, Hephaestus), ELv2 (Superset.sh), BSL 1.1 (AGOR), Proprietary (Conductor). Clear strategic choices.
6. **PM tools racing to add AI agents.** Linear deep-links to coding agents, Jira added assignable AI agents (Feb 2026), Shortcut built MCP server. But none have terminals.
7. **Devin price collapse.** From $500/mo to $20/mo individual. Commoditizing "autonomous agent" but still cloud-only.
8. **CLI agents all going OSS.** Codex CLI, Gemini CLI, Aider, SWE-agent all open source. Value shifts from agent to orchestration layer.
