import { test, expect, seed, goHome, projectBlob, TEST_PROJECT_PATH } from './fixtures/electron'
import type { Page, Locator } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const projectName = 'FS Sync'
const projectAbbrev = 'FS'
const skillSlug = 'e2e-file-sync-skill'
const skillContentV1 = '# File sync skill v1\n\nContent for testing.\n'
const skillContentV2 = '# File sync skill v2\n\nUpdated content.\n'
const instructionsV1 = '# Project instructions v1\n\nThese are test instructions.\n'
const instructionsV2 = '# Project instructions v2\n\nUpdated instructions.\n'

// Disk paths
const claudeInstructionsPath = () => path.join(TEST_PROJECT_PATH, 'CLAUDE.md')
const codexInstructionsPath = () => path.join(TEST_PROJECT_PATH, 'AGENTS.md')
const claudeSkillPath = () => path.join(TEST_PROJECT_PATH, '.claude', 'skills', skillSlug, 'SKILL.md')
const codexSkillPath = () => path.join(TEST_PROJECT_PATH, '.agents', 'skills', skillSlug, 'SKILL.md')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const settingsDialog = (mainWindow: Page): Locator => mainWindow.getByRole('dialog').last()

async function closeTopDialog(mainWindow: Page): Promise<void> {
  const openDialogs = mainWindow.locator('[role="dialog"][data-state="open"]')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await openDialogs.count()) === 0) return
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(100)
  }
  await expect(openDialogs).toHaveCount(0, { timeout: 5_000 })
}

async function openProjectContextManager(mainWindow: Page): Promise<Locator> {
  await closeTopDialog(mainWindow)
  await goHome(mainWindow)

  const blob = projectBlob(mainWindow, projectAbbrev)
  await expect(blob).toBeVisible({ timeout: 5_000 })
  await blob.click({ button: 'right' })
  await mainWindow.getByRole('menuitem', { name: 'Settings' }).click()

  const dialog = settingsDialog(mainWindow)
  await expect(dialog.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 5_000 })
  await dialog.getByTestId('settings-tab-ai-config').click()
  await expect(dialog.getByRole('heading', { name: 'Context Manager' })).toBeVisible({ timeout: 5_000 })
  await dialog.getByRole('tab', { name: 'Config', exact: true }).click()
  const backToOverview = dialog.getByRole('button', { name: 'Overview' })
  if (await backToOverview.count()) {
    await backToOverview.click()
  }
  await expect(dialog.getByTestId('project-context-overview-providers')).toBeVisible({ timeout: 5_000 })
  return dialog
}

async function openProjectContextSection(
  mainWindow: Page,
  section: 'providers' | 'instructions' | 'skills' | 'mcp'
): Promise<Locator> {
  const dialog = await openProjectContextManager(mainWindow)
  const sectionTestIdMap = {
    providers: 'project-context-overview-providers',
    instructions: 'project-context-overview-instructions',
    skills: 'project-context-overview-skills',
    mcp: 'project-context-overview-mcp',
  } as const
  await dialog.getByTestId(sectionTestIdMap[section]).click()
  return dialog
}

function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf-8') } catch { return '' }
}

function cleanupDiskFiles(): void {
  for (const f of [claudeInstructionsPath(), codexInstructionsPath(), claudeSkillPath(), codexSkillPath()]) {
    try { fs.unlinkSync(f) } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Context manager file sync', () => {
  let projectId: string

  test.beforeAll(async ({ mainWindow }) => {
    cleanupDiskFiles()

    const s = seed(mainWindow)
    const project = await s.createProject({ name: projectName, color: '#6366f1', path: TEST_PROJECT_PATH })
    projectId = project.id

    // Enable claude + codex providers
    await mainWindow.evaluate(({ id }) => {
      return window.api.aiConfig.setProjectProviders(id, ['claude', 'codex'])
    }, { id: project.id })

    // Seed instructions content in DB
    await mainWindow.evaluate(({ id, projectPath, content }) => {
      return window.api.aiConfig.saveInstructionsContent(id, projectPath, content)
    }, { id: project.id, projectPath: TEST_PROJECT_PATH, content: instructionsV1 })

    // Create and link a global skill
    await mainWindow.evaluate(async ({ slug, content }) => {
      const existing = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
      const match = existing.find((item) => item.slug === slug)
      if (match) {
        await window.api.aiConfig.updateItem({ id: match.id, content })
      } else {
        await window.api.aiConfig.createItem({ type: 'skill', scope: 'global', slug, content })
      }
    }, { slug: skillSlug, content: skillContentV1 })

    // Link global skill to project
    await mainWindow.evaluate(async ({ projectId: pid, projectPath, slug }) => {
      const items = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
      const item = items.find((i) => i.slug === slug)
      if (!item) throw new Error('Skill not found')
      await window.api.aiConfig.loadGlobalItem({
        projectId: pid, projectPath, itemId: item.id, providers: ['claude', 'codex']
      })
    }, { projectId: project.id, projectPath: TEST_PROJECT_PATH, slug: skillSlug })

    await s.refreshData()
    await goHome(mainWindow)
    await expect(projectBlob(mainWindow, projectAbbrev)).toBeVisible({ timeout: 5_000 })
  })

  // =========================================================================
  // Instructions tests
  // =========================================================================

  test.describe('Instructions', () => {
    test('edit auto-saves to DB', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'instructions')
      const textarea = dialog.getByTestId('instructions-textarea')
      await expect(textarea).toBeVisible({ timeout: 5_000 })

      await textarea.fill(instructionsV2)

      // Wait for debounced save (800ms) + processing
      await expect.poll(async () => {
        const result = await mainWindow.evaluate(({ id, projectPath }) => {
          return window.api.aiConfig.getRootInstructions(id, projectPath)
        }, { id: projectId, projectPath: TEST_PROJECT_PATH })
        return result.content
      }, { timeout: 5_000 }).toBe(instructionsV2)

      await closeTopDialog(mainWindow)
    })

    test('Config → File pushes to specific provider', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'instructions')

      const pushClaude = dialog.getByTestId('instructions-push-claude')
      await expect(pushClaude).toBeVisible({ timeout: 5_000 })
      await pushClaude.click()

      // Verify CLAUDE.md written on disk
      await expect.poll(() => readFileSafe(claudeInstructionsPath())).toBe(instructionsV2)

      // Verify card shows Synced
      const card = dialog.getByTestId('instructions-provider-card-claude')
      await expect(card).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('Config → All Files pushes to all providers', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'instructions')

      const pushAll = dialog.getByTestId('instructions-push-all')
      await expect(pushAll).toBeVisible({ timeout: 5_000 })
      await pushAll.click()

      // Verify both files on disk
      await expect.poll(() => readFileSafe(claudeInstructionsPath())).toBe(instructionsV2)
      await expect.poll(() => readFileSafe(codexInstructionsPath())).toBe(instructionsV2)

      // Verify both cards show Synced
      await expect(dialog.getByTestId('instructions-provider-card-claude')).toContainText('Synced', { timeout: 5_000 })
      await expect(dialog.getByTestId('instructions-provider-card-codex')).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('stale detection after disk modification', async ({ mainWindow }) => {
      // Modify CLAUDE.md externally
      fs.writeFileSync(claudeInstructionsPath(), '# Externally modified\n')

      // Reopen and check stale status
      const dialog = await openProjectContextSection(mainWindow, 'instructions')
      const card = dialog.getByTestId('instructions-provider-card-claude')
      await expect(card).toContainText('Stale', { timeout: 5_000 })

      // Codex should still be synced
      await expect(dialog.getByTestId('instructions-provider-card-codex')).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('expand stale card shows diff', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'instructions')
      const card = dialog.getByTestId('instructions-provider-card-claude')
      await expect(card).toContainText('Stale', { timeout: 5_000 })

      // Click card to expand diff
      await card.click()

      // Verify diff view appears (has left/right labels)
      await expect(card.getByText('on disk')).toBeVisible({ timeout: 5_000 })
      await expect(card.getByText('App content')).toBeVisible({ timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('File → Config pulls from disk', async ({ mainWindow }) => {
      // CLAUDE.md was externally modified in earlier test
      const diskContent = readFileSafe(claudeInstructionsPath())

      const dialog = await openProjectContextSection(mainWindow, 'instructions')

      const pullClaude = dialog.getByTestId('instructions-pull-claude')
      await expect(pullClaude).toBeVisible({ timeout: 5_000 })
      await pullClaude.click()

      // Verify textarea updated with disk content
      const textarea = dialog.getByTestId('instructions-textarea')
      await expect(textarea).toHaveValue(diskContent, { timeout: 5_000 })

      // Verify all providers now synced
      await expect(dialog.getByTestId('instructions-provider-card-claude')).toContainText('Synced', { timeout: 5_000 })

      // DB should also reflect pulled content
      await expect.poll(async () => {
        const result = await mainWindow.evaluate(({ id, projectPath }) => {
          return window.api.aiConfig.getRootInstructions(id, projectPath)
        }, { id: projectId, projectPath: TEST_PROJECT_PATH })
        return result.content
      }).toBe(diskContent)

      await closeTopDialog(mainWindow)
    })
  })

  // =========================================================================
  // Skills tests
  // =========================================================================

  test.describe('Skills', () => {
    test('expand shows editor with auto-save', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'skills')

      // Click skill row to expand
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await expect(skillRow).toBeVisible({ timeout: 5_000 })
      await skillRow.click()

      // Verify content editor visible
      const content = dialog.getByTestId('skill-detail-content')
      await expect(content).toBeVisible({ timeout: 5_000 })
      await expect(content).toHaveValue(skillContentV1, { timeout: 5_000 })

      // Edit and verify auto-save
      await content.fill(skillContentV2)

      await expect.poll(async () => {
        return await mainWindow.evaluate(async (slug) => {
          const items = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
          const match = items.find((i) => i.slug === slug)
          return match?.content ?? null
        }, skillSlug)
      }, { timeout: 5_000 }).toBe(skillContentV2)

      await closeTopDialog(mainWindow)
    })

    test('Config → File pushes skill to specific provider', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const pushClaude = dialog.getByTestId(`skill-push-claude-${skillSlug}`)
      await expect(pushClaude).toBeVisible({ timeout: 5_000 })
      await pushClaude.click()

      // Verify .claude/skills/{slug}/SKILL.md written with frontmatter
      await expect.poll(() => {
        const content = readFileSafe(claudeSkillPath())
        return content.includes(`name: ${skillSlug}`) && content.includes(skillContentV2.trim())
      }).toBe(true)

      // Verify claude card shows synced
      const claudeCard = dialog.getByTestId(`skill-provider-card-claude-${skillSlug}`)
      await expect(claudeCard).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('Config → All Files pushes to all providers', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const pushAll = dialog.getByTestId(`skill-push-all-${skillSlug}`)
      await expect(pushAll).toBeVisible({ timeout: 5_000 })
      await pushAll.click()

      // Verify both provider files on disk
      await expect.poll(() => {
        const content = readFileSafe(claudeSkillPath())
        return content.includes(`name: ${skillSlug}`) && content.includes(skillContentV2.trim())
      }).toBe(true)
      await expect.poll(() => readFileSafe(codexSkillPath())).toBe(skillContentV2)

      // Verify both cards show synced
      await expect(dialog.getByTestId(`skill-provider-card-claude-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })
      await expect(dialog.getByTestId(`skill-provider-card-codex-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('stale detection after external disk modification', async ({ mainWindow }) => {
      // Externally modify the claude skill file
      const modified = '---\nname: modified\n---\n# Modified externally\n'
      fs.writeFileSync(claudeSkillPath(), modified)

      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)

      // Row should show stale aggregate
      await expect(skillRow).toContainText('Stale', { timeout: 5_000 })

      // Expand to see per-provider status
      await skillRow.click()
      const claudeCard = dialog.getByTestId(`skill-provider-card-claude-${skillSlug}`)
      await expect(claudeCard).toContainText('Stale', { timeout: 5_000 })

      // Codex should still be synced
      await expect(dialog.getByTestId(`skill-provider-card-codex-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('expand stale skill card shows diff', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const claudeCard = dialog.getByTestId(`skill-provider-card-claude-${skillSlug}`)
      await expect(claudeCard).toContainText('Stale', { timeout: 5_000 })

      // Click card to expand diff
      await claudeCard.click()

      // Verify diff labels appear
      await expect(claudeCard.getByText('on disk')).toBeVisible({ timeout: 5_000 })
      await expect(claudeCard.getByText('Expected content')).toBeVisible({ timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('File → Config pulls from disk and strips frontmatter', async ({ mainWindow }) => {
      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const pullClaude = dialog.getByTestId(`skill-pull-claude-${skillSlug}`)
      await expect(pullClaude).toBeVisible({ timeout: 5_000 })
      await pullClaude.click()

      // Verify DB content updated with frontmatter stripped
      await expect.poll(async () => {
        return await mainWindow.evaluate(async (slug) => {
          const items = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
          const match = items.find((i) => i.slug === slug)
          return match?.content ?? null
        }, skillSlug)
      }, { timeout: 5_000 }).toBe('# Modified externally\n')

      await closeTopDialog(mainWindow)
    })

    test('filename rename updates slug', async ({ mainWindow }) => {
      const newSlug = 'e2e-file-sync-renamed'

      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const filenameInput = dialog.getByTestId('skill-detail-filename')
      await expect(filenameInput).toBeVisible({ timeout: 5_000 })
      await filenameInput.fill(newSlug)

      const renameButton = dialog.getByTestId('skill-detail-rename')
      await expect(renameButton).toBeVisible({ timeout: 5_000 })
      await renameButton.click()

      // Verify slug updated in DB
      await expect.poll(async () => {
        return await mainWindow.evaluate(async (slug) => {
          const items = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
          return items.some((i) => i.slug === slug)
        }, newSlug)
      }, { timeout: 5_000 }).toBe(true)

      // Verify new row visible
      await expect(dialog.getByTestId(`project-context-item-skill-${newSlug}`)).toBeVisible({ timeout: 5_000 })

      // Rename back for subsequent tests — need to close/reopen dialog since onChanged reloads data
      await closeTopDialog(mainWindow)
      const dialog2 = await openProjectContextSection(mainWindow, 'skills')
      await dialog2.getByTestId(`project-context-item-skill-${newSlug}`).click()
      const input = dialog2.getByTestId('skill-detail-filename')
      await expect(input).toBeVisible({ timeout: 5_000 })
      await input.fill(skillSlug)
      await dialog2.getByTestId('skill-detail-rename').click()
      await expect(dialog2.getByTestId(`project-context-item-skill-${skillSlug}`)).toBeVisible({ timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('Config → File after pull re-syncs to disk', async ({ mainWindow }) => {
      // First push all to have a clean state
      const dialog = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()

      const pushAll = dialog.getByTestId(`skill-push-all-${skillSlug}`)
      await pushAll.click()

      // Verify both synced
      await expect(dialog.getByTestId(`skill-provider-card-claude-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })
      await expect(dialog.getByTestId(`skill-provider-card-codex-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })

      // Verify files on disk
      await expect.poll(() => readFileSafe(claudeSkillPath()).length > 0).toBe(true)
      await expect.poll(() => readFileSafe(codexSkillPath()).length > 0).toBe(true)

      await closeTopDialog(mainWindow)
    })
  })

  // =========================================================================
  // Cross-feature tests
  // =========================================================================

  test.describe('Integration', () => {
    test('full instructions roundtrip: push → external edit → stale → pull', async ({ mainWindow }) => {
      const testContent = '# Roundtrip test\n\nFull cycle.\n'
      const externalEdit = '# Externally edited\n\nDifferent content.\n'

      // 1. Set instructions via API
      await mainWindow.evaluate(({ id, projectPath, content }) => {
        return window.api.aiConfig.saveInstructionsContent(id, projectPath, content)
      }, { id: projectId, projectPath: TEST_PROJECT_PATH, content: testContent })

      // 2. Push to all
      const dialog = await openProjectContextSection(mainWindow, 'instructions')
      await dialog.getByTestId('instructions-push-all').click()
      await expect.poll(() => readFileSafe(claudeInstructionsPath())).toBe(testContent)

      // 3. Externally edit
      fs.writeFileSync(claudeInstructionsPath(), externalEdit)

      // 4. Close and reopen to pick up stale status
      await closeTopDialog(mainWindow)
      const dialog2 = await openProjectContextSection(mainWindow, 'instructions')
      await expect(dialog2.getByTestId('instructions-provider-card-claude')).toContainText('Stale', { timeout: 5_000 })

      // 5. Pull from claude
      await dialog2.getByTestId('instructions-pull-claude').click()
      await expect(dialog2.getByTestId('instructions-textarea')).toHaveValue(externalEdit, { timeout: 5_000 })

      // 6. Push to all again to sync codex
      await dialog2.getByTestId('instructions-push-all').click()
      await expect(dialog2.getByTestId('instructions-provider-card-claude')).toContainText('Synced', { timeout: 5_000 })
      await expect(dialog2.getByTestId('instructions-provider-card-codex')).toContainText('Synced', { timeout: 5_000 })

      await closeTopDialog(mainWindow)
    })

    test('needsSync returns false after all providers synced', async ({ mainWindow }) => {
      // Push all instructions
      const dialog = await openProjectContextSection(mainWindow, 'instructions')
      await dialog.getByTestId('instructions-push-all').click()
      await expect(dialog.getByTestId('instructions-provider-card-claude')).toContainText('Synced', { timeout: 5_000 })
      await closeTopDialog(mainWindow)

      // Push all skills
      const dialog2 = await openProjectContextSection(mainWindow, 'skills')
      const skillRow = dialog2.getByTestId(`project-context-item-skill-${skillSlug}`)
      await skillRow.click()
      await dialog2.getByTestId(`skill-push-all-${skillSlug}`).click()
      await expect(dialog2.getByTestId(`skill-provider-card-claude-${skillSlug}`)).toContainText('Synced', { timeout: 5_000 })
      await closeTopDialog(mainWindow)

      // Verify needsSync is false
      await expect.poll(async () => {
        return await mainWindow.evaluate(({ id, projectPath }) => {
          return window.api.aiConfig.needsSync(id, projectPath)
        }, { id: projectId, projectPath: TEST_PROJECT_PATH })
      }).toBe(false)
    })
  })
})
