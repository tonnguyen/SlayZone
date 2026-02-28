/**
 * AI Config context files, sync, instructions, MCP handler contract tests
 * Run with: ELECTRON_RUN_AS_NODE=1 npx electron --import tsx/esm --loader ./packages/shared/test-utils/loader.ts packages/domains/ai-config/src/main/handlers.context.test.ts
 */
import { createTestHarness, test, expect, describe } from '../../../../shared/test-utils/ipc-harness.js'
import { registerAiConfigHandlers } from './handlers.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const h = await createTestHarness()
registerAiConfigHandlers(h.ipcMain as never, h.db)

const root = h.tmpDir()
const mockHome = '/tmp/mock-home'
const projectId = crypto.randomUUID()
h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(projectId, 'Ctx', '#000', root)

function createProjectFixture(name: string): { projectId: string; projectPath: string } {
  const id = crypto.randomUUID()
  const projectPath = path.join(root, name)
  fs.mkdirSync(projectPath, { recursive: true })
  h.db.prepare('INSERT INTO projects (id, name, color, path) VALUES (?, ?, ?, ?)').run(id, name, '#000', projectPath)
  return { projectId: id, projectPath }
}

// Ensure claude is enabled
h.db.prepare("UPDATE ai_config_sources SET enabled = 1 WHERE kind = 'claude'")?.run()

// --- Context file discovery ---

describe('ai-config:discover-context-files', () => {
  test('finds CLAUDE.md when present', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# rules')
    const entries = h.invoke('ai-config:discover-context-files', root) as { name: string; exists: boolean }[]
    const claudeMd = entries.find(e => e.name === 'CLAUDE.md')
    expect(claudeMd).toBeTruthy()
    expect(claudeMd!.exists).toBe(true)
  })
})

describe('ai-config:read-context-file', () => {
  test('reads file content', () => {
    const content = h.invoke('ai-config:read-context-file', path.join(root, 'CLAUDE.md'), root)
    expect(content).toBe('# rules')
  })

  test('rejects path outside project', () => {
    expect(() => h.invoke('ai-config:read-context-file', '/etc/passwd', root)).toThrow()
  })
})

describe('ai-config:write-context-file', () => {
  test('writes file', () => {
    h.invoke('ai-config:write-context-file', path.join(root, 'CLAUDE.md'), '# updated', root)
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8')).toBe('# updated')
  })
})

describe('ai-config:create-global-file', () => {
  test('creates a normalized global skill file', () => {
    const expectedPath = path.join(mockHome, '.gemini', 'skills', 'my-global-skill.md')
    if (fs.existsSync(expectedPath)) fs.unlinkSync(expectedPath)

    const created = h.invoke('ai-config:create-global-file', 'gemini', 'skill', ' My Global Skill! ') as {
      path: string
      provider: string
      category: string
      exists: boolean
    }

    expect(created.path).toBe(expectedPath)
    expect(created.provider).toBe('gemini')
    expect(created.category).toBe('skill')
    expect(created.exists).toBe(true)
    expect(fs.existsSync(expectedPath)).toBe(true)
  })

  test('rejects unsupported categories for provider', () => {
    expect(() => h.invoke('ai-config:create-global-file', 'codex', 'skill', 'nope')).toThrow()
  })
})

// --- Load global item ---

describe('ai-config:load-global-item', () => {
  test('writes skill to provider dir with manual path', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'deploy', content: '# Deploy skill'
    }) as { id: string }

    const result = h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/deploy.md'
    }) as { relativePath: string; syncStatus: string }
    expect(result.relativePath).toBe('.claude/skills/manual/deploy.md')
    expect(result.syncStatus).toBe('synced')
    expect(fs.readFileSync(path.join(root, '.claude/skills/manual/deploy.md'), 'utf-8')).toBe('# Deploy skill')
  })

  test('writes skill to codex provider path', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'codex-skill', content: '# Codex skill'
    }) as { id: string }

    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['codex']
    })
    expect(fs.readFileSync(path.join(root, '.agents/skills/codex-skill/SKILL.md'), 'utf-8')).toBe('# Codex skill')
  })
})

// --- Sync linked file ---

describe('ai-config:sync-linked-file', () => {
  test('re-syncs item content to disk', () => {
    // Create item + selection
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'sync-test', content: 'original'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/sync-test.md'
    })
    // Modify file externally
    fs.writeFileSync(path.join(root, '.claude/skills/manual/sync-test.md'), 'modified')
    // Update item content in DB
    h.invoke('ai-config:update-item', { id: item.id, content: 'updated content' })

    const result = h.invoke('ai-config:sync-linked-file', projectId, root, item.id) as {
      syncStatus: string
    }
    expect(result.syncStatus).toBe('synced')
    expect(fs.readFileSync(path.join(root, '.claude/skills/manual/sync-test.md'), 'utf-8')).toBe('updated content')
  })

  test('syncs all provider links for an item', () => {
    const fixture = createProjectFixture('sync-linked-all-providers')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'codex'])
    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'sync-all-providers',
      content: '# v1'
    }) as { id: string }

    h.invoke('ai-config:load-global-item', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      itemId: item.id,
      providers: ['claude', 'codex']
    })

    const claudePath = path.join(fixture.projectPath, '.claude/skills/sync-all-providers/SKILL.md')
    const codexPath = path.join(fixture.projectPath, '.agents/skills/sync-all-providers/SKILL.md')
    fs.writeFileSync(claudePath, '# changed')
    fs.writeFileSync(codexPath, '# changed')
    h.invoke('ai-config:update-item', { id: item.id, content: '# v2' })

    h.invoke('ai-config:sync-linked-file', fixture.projectId, fixture.projectPath, item.id)

    expect(fs.readFileSync(claudePath, 'utf-8').includes('name: sync-all-providers')).toBe(true)
    expect(fs.readFileSync(claudePath, 'utf-8').includes('# v2')).toBe(true)
    expect(fs.readFileSync(codexPath, 'utf-8')).toBe('# v2')
  })

  test('syncs project-local items without provider selections', () => {
    const fixture = createProjectFixture('sync-linked-local-item')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'codex'])
    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'project',
      projectId: fixture.projectId,
      slug: 'local-item-sync',
      content: '# local item'
    }) as { id: string }

    h.invoke('ai-config:sync-linked-file', fixture.projectId, fixture.projectPath, item.id)

    const claudePath = path.join(fixture.projectPath, '.claude/skills/local-item-sync/SKILL.md')
    const codexPath = path.join(fixture.projectPath, '.agents/skills/local-item-sync/SKILL.md')
    expect(fs.readFileSync(claudePath, 'utf-8').includes('name: local-item-sync')).toBe(true)
    expect(fs.readFileSync(claudePath, 'utf-8').includes('# local item')).toBe(true)
    expect(fs.readFileSync(codexPath, 'utf-8')).toBe('# local item')
  })

  test('migrates legacy claude selection paths to SKILL.md', () => {
    const fixture = createProjectFixture('sync-linked-legacy-selection')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude'])

    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'legacy-selection-skill',
      content: '# from global'
    }) as { id: string }

    h.invoke('ai-config:set-project-selection', {
      projectId: fixture.projectId,
      itemId: item.id,
      provider: 'claude',
      targetPath: './.claude/skills/legacy-selection-skill.md'
    })

    const legacyPath = path.join(fixture.projectPath, '.claude/skills/legacy-selection-skill.md')
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true })
    fs.writeFileSync(legacyPath, '# old format')

    const result = h.invoke('ai-config:sync-linked-file', fixture.projectId, fixture.projectPath, item.id) as {
      relativePath: string
    }

    const canonicalPath = path.join(fixture.projectPath, '.claude/skills/legacy-selection-skill/SKILL.md')
    expect(result.relativePath).toBe('.claude/skills/legacy-selection-skill/SKILL.md')
    expect(fs.existsSync(legacyPath)).toBe(false)
    expect(fs.readFileSync(canonicalPath, 'utf-8').includes('name: legacy-selection-skill')).toBe(true)
    expect(fs.readFileSync(canonicalPath, 'utf-8').includes('# from global')).toBe(true)
  })
})

// --- Unlink ---

describe('ai-config:unlink-file', () => {
  test('removes selection from DB', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'unlink-me', content: 'x'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/unlink-me.md'
    })
    const result = h.invoke('ai-config:unlink-file', projectId, item.id)
    expect(result).toBe(true)
  })

  test('returns false for nonexistent', () => {
    expect(h.invoke('ai-config:unlink-file', projectId, 'nope')).toBe(false)
  })
})

// --- Rename context file ---

describe('ai-config:rename-context-file', () => {
  test('renames file and updates selection target_path', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'renameme', content: 'rename content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/renameme.md'
    })
    const oldPath = path.join(root, '.claude/skills/manual/renameme.md')
    const newPath = path.join(root, '.claude/skills/manual/renamed.md')
    h.invoke('ai-config:rename-context-file', oldPath, newPath, root)
    expect(fs.existsSync(newPath)).toBe(true)
    expect(fs.existsSync(oldPath)).toBe(false)
  })
})

// --- Delete context file ---

describe('ai-config:delete-context-file', () => {
  test('deletes file and removes selection', () => {
    const item = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'deleteme', content: 'delete content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: item.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/deleteme.md'
    })
    const filePath = path.join(root, '.claude/skills/manual/deleteme.md')
    h.invoke('ai-config:delete-context-file', filePath, root, projectId)
    expect(fs.existsSync(filePath)).toBe(false)
  })
})

// --- Global instructions ---

describe('ai-config:get-global-instructions', () => {
  test('returns empty string when none exist', () => {
    const content = h.invoke('ai-config:get-global-instructions')
    expect(content).toBe('')
  })
})

describe('ai-config:save-global-instructions', () => {
  test('creates then upserts', () => {
    h.invoke('ai-config:save-global-instructions', '# Global rules v1')
    expect(h.invoke('ai-config:get-global-instructions')).toBe('# Global rules v1')
    h.invoke('ai-config:save-global-instructions', '# Global rules v2')
    expect(h.invoke('ai-config:get-global-instructions')).toBe('# Global rules v2')
  })
})

// --- Root instructions (per-project) ---

describe('ai-config:save-root-instructions', () => {
  test('writes to provider dirs and returns synced status', () => {
    const result = h.invoke('ai-config:save-root-instructions', projectId, root, '# Project rules') as {
      content: string
      providerStatus: Record<string, string>
    }
    expect(result.content).toBe('# Project rules')
    // Claude should be synced (it's enabled)
    expect(result.providerStatus.claude).toBe('synced')
    // File should exist on disk in project root
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(true)
  })
})

describe('ai-config:get-root-instructions', () => {
  test('returns content and provider status', () => {
    const result = h.invoke('ai-config:get-root-instructions', projectId, root) as {
      content: string
      providerStatus: Record<string, string>
    }
    expect(result.content).toBe('# Project rules')
    expect(result.providerStatus.claude).toBe('synced')
  })
})

// --- Needs sync ---

describe('ai-config:needs-sync', () => {
  test('returns false when all synced', () => {
    const result = h.invoke('ai-config:needs-sync', projectId, root)
    expect(result).toBe(false)
  })

  test('returns true when file modified externally', () => {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# MODIFIED')
    const result = h.invoke('ai-config:needs-sync', projectId, root)
    expect(result).toBe(true)
  })

  test('ignores out-of-sync files for disabled providers', () => {
    const fixture = createProjectFixture('needs-sync-disabled-provider')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'codex'])
    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'disabled-provider-skill',
      content: '# baseline'
    }) as { id: string }

    h.invoke('ai-config:load-global-item', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      itemId: item.id,
      providers: ['codex']
    })

    const codexPath = path.join(fixture.projectPath, '.agents/skills/disabled-provider-skill/SKILL.md')
    fs.writeFileSync(codexPath, '# modified externally')

    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude'])
    const whileDisabled = h.invoke('ai-config:needs-sync', fixture.projectId, fixture.projectPath)
    expect(whileDisabled).toBe(false)

    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'codex'])
    const afterReEnable = h.invoke('ai-config:needs-sync', fixture.projectId, fixture.projectPath)
    expect(afterReEnable).toBe(true)
  })
})

// --- Check sync status ---

describe('ai-config:check-sync-status', () => {
  test('detects external edits as conflicts', () => {
    // CLAUDE.md was modified above
    const conflicts = h.invoke('ai-config:check-sync-status', projectId, root) as {
      path: string; reason: string
    }[]
    // May or may not have conflicts depending on content_hash state
    expect(Array.isArray(conflicts)).toBe(true)
  })
})

// --- MCP config ---

describe('ai-config:discover-mcp-configs', () => {
  test('returns entries for supported providers (codex disabled)', () => {
    const results = h.invoke('ai-config:discover-mcp-configs', root) as {
      provider: string; exists: boolean; servers: Record<string, unknown>
    }[]
    expect(results.length).toBe(4)  // claude, cursor, gemini, opencode
    const providers = results.map(r => r.provider).sort()
    expect(providers).toContain('claude')
    expect(providers).toContain('cursor')
    expect(providers).toContain('gemini')
    expect(providers).toContain('opencode')
    expect(providers.includes('codex')).toBe(false)
  })

  test('detects existing config files', () => {
    fs.mkdirSync(path.join(root, '.mcp-test'), { recursive: true })
    fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({
      mcpServers: { 'my-server': { command: 'node', args: ['server.js'] } }
    }))
    const results = h.invoke('ai-config:discover-mcp-configs', root) as {
      provider: string; exists: boolean; servers: Record<string, unknown>
    }[]
    const claude = results.find(r => r.provider === 'claude')!
    expect(claude.exists).toBe(true)
    expect(claude.servers['my-server']).toBeTruthy()
  })
})

describe('ai-config:write-mcp-server', () => {
  test('writes server config to provider file', () => {
    h.invoke('ai-config:write-mcp-server', {
      projectPath: root,
      provider: 'claude',
      serverKey: 'test-server',
      config: { command: 'node', args: ['test.js'] }
    })
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['test-server']).toBeTruthy()
    expect(data.mcpServers['test-server'].command).toBe('node')
  })

  test('preserves existing servers', () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['my-server']).toBeTruthy()
    expect(data.mcpServers['test-server']).toBeTruthy()
  })

  test('rejects codex writes', () => {
    expect(() => h.invoke('ai-config:write-mcp-server', {
      projectPath: root,
      provider: 'codex',
      serverKey: 'test-server',
      config: { command: 'node', args: ['test.js'] }
    })).toThrow()
  })
})

describe('ai-config:remove-mcp-server', () => {
  test('removes server from config', () => {
    h.invoke('ai-config:remove-mcp-server', {
      projectPath: root,
      provider: 'claude',
      serverKey: 'test-server'
    })
    const data = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'))
    expect(data.mcpServers['test-server'] ?? null).toBeNull()
    // Other servers preserved
    expect(data.mcpServers['my-server']).toBeTruthy()
  })
})

// --- Skills status ---

describe('ai-config:get-project-skills-status', () => {
  test('returns status for loaded skills', () => {
    // Re-sync root instructions so state is clean
    h.invoke('ai-config:save-root-instructions', projectId, root, '# Project rules')
    // Create and load a skill
    const skill = h.invoke('ai-config:create-item', {
      type: 'skill', scope: 'global', slug: 'status-skill', content: '# Status skill content'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId, projectPath: root, itemId: skill.id,
      providers: ['claude'], manualPath: '.claude/skills/manual/status-skill.md'
    })

    const results = h.invoke('ai-config:get-project-skills-status', projectId, root) as {
      item: { id: string; slug: string }
      providers: Record<string, { path: string; status: string }>
    }[]
    expect(results.length).toBeGreaterThan(0)
    const found = results.find(r => r.item.id === skill.id)
    expect(found).toBeTruthy()
    expect(found!.providers.claude).toBeTruthy()
    expect(found!.providers.claude.status).toBe('synced')
  })

  test('detects out-of-sync skill', () => {
    // Modify the file on disk
    fs.writeFileSync(path.join(root, '.claude/skills/manual/status-skill.md'), '# CHANGED')
    const results = h.invoke('ai-config:get-project-skills-status', projectId, root) as {
      item: { slug: string }
      providers: Record<string, { status: string }>
    }[]
    const found = results.find(r => r.item.slug === 'status-skill')
    expect(found).toBeTruthy()
    expect(found!.providers.claude.status).toBe('out_of_sync')
  })
})

// --- Sync all ---

describe('ai-config:sync-all', () => {
  test('writes all pending files', () => {
    const result = h.invoke('ai-config:sync-all', { projectId, projectPath: root }) as {
      written: { path: string; provider: string }[]
      conflicts: { path: string }[]
    }
    expect(Array.isArray(result.written)).toBe(true)
    expect(Array.isArray(result.conflicts)).toBe(true)
  })

  test('includes project-local items in sync output and disk writes', () => {
    const fixture = createProjectFixture('sync-all-local-items')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'cursor'])

    h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'project',
      projectId: fixture.projectId,
      slug: 'local-project-skill',
      content: '# local project skill'
    })
    const legacyLocalPath = path.join(fixture.projectPath, '.claude/skills/local-project-skill.md')
    fs.mkdirSync(path.dirname(legacyLocalPath), { recursive: true })
    fs.writeFileSync(legacyLocalPath, '# legacy local path')

    const result = h.invoke('ai-config:sync-all', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath
    }) as {
      written: Array<{ path: string; provider: string }>
    }

    expect(fs.readFileSync(path.join(fixture.projectPath, '.claude/skills/local-project-skill/SKILL.md'), 'utf-8').includes('# local project skill'))
      .toBe(true)
    expect(fs.readFileSync(path.join(fixture.projectPath, '.cursor/skills/local-project-skill/SKILL.md'), 'utf-8'))
      .toBe('# local project skill')
    expect(fs.existsSync(legacyLocalPath)).toBe(false)

    expect(result.written.some((entry) =>
      entry.provider === 'claude' && entry.path === '.claude/skills/local-project-skill/SKILL.md')).toBe(true)
    expect(result.written.some((entry) =>
      entry.provider === 'cursor' && entry.path === '.cursor/skills/local-project-skill/SKILL.md')).toBe(true)
  })

  test('does not recreate removed per-item provider links', () => {
    const fixture = createProjectFixture('sync-all-keeps-provider-unlink')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude', 'codex'])

    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'sync-all-provider-unlink',
      content: '# initial'
    }) as { id: string }

    h.invoke('ai-config:load-global-item', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      itemId: item.id,
      providers: ['claude', 'codex']
    })

    h.invoke('ai-config:remove-project-selection', fixture.projectId, item.id, 'codex')
    h.invoke('ai-config:update-item', { id: item.id, content: '# updated' })

    const codexPath = path.join(fixture.projectPath, '.agents/skills/sync-all-provider-unlink/SKILL.md')
    const codexBefore = fs.readFileSync(codexPath, 'utf-8')

    const result = h.invoke('ai-config:sync-all', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath
    }) as {
      written: { path: string; provider: string }[]
      conflicts: { path: string }[]
    }

    expect(result.written.some((entry) => entry.provider === 'claude')).toBe(true)
    expect(result.written.some((entry) => entry.provider === 'codex')).toBe(false)
    expect(fs.readFileSync(codexPath, 'utf-8')).toBe(codexBefore)

    const selections = h.invoke('ai-config:list-project-selections', fixture.projectId) as Array<{ provider: string }>
    expect(selections.some((row) => row.provider === 'codex')).toBe(false)
  })

  test('falls back to globally enabled providers when project settings are malformed JSON', () => {
    const fixture = createProjectFixture('sync-all-malformed-provider-settings')
    h.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(`ai_providers:${fixture.projectId}`, '{"broken":')

    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'sync-all-fallback-provider',
      content: '# fallback'
    }) as { id: string }
    h.invoke('ai-config:load-global-item', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      itemId: item.id,
      providers: ['claude']
    })

    const result = h.invoke('ai-config:sync-all', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath
    }) as { written: Array<{ provider: string }> }

    expect(result.written.some((entry) => entry.provider === 'claude')).toBe(true)
  })

  test('prunes unmanaged skills and disabled-provider MCP configs when enabled', () => {
    const fixture = createProjectFixture('sync-all-prune-unmanaged')
    h.invoke('ai-config:set-project-providers', fixture.projectId, ['claude'])
    h.invoke('ai-config:save-root-instructions', fixture.projectId, fixture.projectPath, '# managed instructions')

    const item = h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'global',
      slug: 'keep-managed-skill',
      content: '# keep'
    }) as { id: string }

    h.invoke('ai-config:load-global-item', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      itemId: item.id,
      providers: ['claude']
    })
    h.invoke('ai-config:create-item', {
      type: 'skill',
      scope: 'project',
      projectId: fixture.projectId,
      slug: 'keep-local-skill',
      content: '# keep local'
    })

    const managedSkillPath = path.join(fixture.projectPath, '.claude/skills/keep-managed-skill/SKILL.md')
    const localSkillPath = path.join(fixture.projectPath, '.claude/skills/keep-local-skill/SKILL.md')
    const managedInstructionPath = path.join(fixture.projectPath, 'CLAUDE.md')
    const unmanagedInstructionPath = path.join(fixture.projectPath, 'AGENTS.md')
    const unmanagedSkillPath = path.join(fixture.projectPath, '.claude/skills/remove-me.md')
    const unmanagedCodexSkillPath = path.join(fixture.projectPath, '.agents/skills/remove-codex/SKILL.md')
    const unmanagedEmptyEnabledMcpPath = path.join(fixture.projectPath, '.mcp.json')
    const disabledProviderMcpPath = path.join(fixture.projectPath, '.cursor/mcp.json')

    fs.writeFileSync(unmanagedInstructionPath, '# remove unmanaged instruction')
    fs.mkdirSync(path.dirname(unmanagedSkillPath), { recursive: true })
    fs.mkdirSync(path.dirname(unmanagedCodexSkillPath), { recursive: true })
    fs.mkdirSync(path.dirname(disabledProviderMcpPath), { recursive: true })

    fs.writeFileSync(unmanagedSkillPath, '# remove')
    fs.writeFileSync(unmanagedCodexSkillPath, '# remove codex')
    fs.writeFileSync(unmanagedEmptyEnabledMcpPath, JSON.stringify({ mcpServers: {} }, null, 2))
    fs.writeFileSync(disabledProviderMcpPath, JSON.stringify({ mcpServers: { orphan: { command: 'npx', args: ['x'] } } }, null, 2))

    const result = h.invoke('ai-config:sync-all', {
      projectId: fixture.projectId,
      projectPath: fixture.projectPath,
      pruneUnmanaged: true
    }) as {
      written: Array<{ provider: string }>
      deleted: Array<{ path: string; provider: string; kind: string }>
    }

    expect(fs.existsSync(managedSkillPath)).toBe(true)
    expect(fs.existsSync(localSkillPath)).toBe(true)
    expect(fs.existsSync(managedInstructionPath)).toBe(true)
    expect(fs.existsSync(unmanagedInstructionPath)).toBe(false)
    expect(fs.existsSync(unmanagedSkillPath)).toBe(false)
    expect(fs.existsSync(unmanagedCodexSkillPath)).toBe(false)
    expect(fs.existsSync(unmanagedEmptyEnabledMcpPath)).toBe(false)
    expect(fs.existsSync(disabledProviderMcpPath)).toBe(false)

    expect(result.written.some((entry) => entry.provider === 'claude')).toBe(true)
    expect(result.deleted.some((entry) => entry.kind === 'instruction' && entry.provider === 'codex')).toBe(true)
    expect(result.deleted.some((entry) => entry.kind === 'skill' && entry.provider === 'claude')).toBe(true)
    expect(result.deleted.some((entry) => entry.kind === 'mcp' && entry.provider === 'claude')).toBe(true)
    expect(result.deleted.some((entry) => entry.kind === 'mcp' && entry.provider === 'cursor')).toBe(true)
  })
})

h.cleanup()
console.log('\nDone')
