import { test, expect, seed, clickSettings, goHome, projectBlob, TEST_PROJECT_PATH } from './fixtures/electron'
import type { Page, Locator } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const projectName = 'CM Sync'
const projectAbbrev = 'CM'
const skillSlug = 'e2e-context-sync-skill'
const skillContentV1 = '# E2E context skill v1\n'
const skillContentV2 = '# E2E context skill v2\n'
const localSkillSlug = 'e2e-local-project-skill'
const localSkillContent = '# E2E local project skill\n'
const settingsDialog = (mainWindow: Page): Locator => mainWindow.getByRole('dialog').last()
const claudeSkillPath = () => path.join(TEST_PROJECT_PATH, '.claude', 'skills', skillSlug, 'SKILL.md')
const codexSkillPath = () => path.join(TEST_PROJECT_PATH, '.agents', 'skills', skillSlug, 'SKILL.md')
const localClaudeSkillPath = () => path.join(TEST_PROJECT_PATH, '.claude', 'skills', localSkillSlug, 'SKILL.md')
const localCodexSkillPath = () => path.join(TEST_PROJECT_PATH, '.agents', 'skills', localSkillSlug, 'SKILL.md')
async function closeTopDialog(mainWindow: Page): Promise<void> {
  const openDialogs = mainWindow.locator('[role="dialog"][data-state="open"]')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await openDialogs.count()) === 0) return
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(100)
  }
  await expect(openDialogs).toHaveCount(0, { timeout: 5_000 })
}

async function openGlobalContextManager(mainWindow: Page): Promise<Locator> {
  await closeTopDialog(mainWindow)
  await clickSettings(mainWindow)

  const dialog = settingsDialog(mainWindow)
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.getByTestId('settings-tab-ai-config').click()
  await expect(dialog.getByRole('heading', { name: 'Context Manager' })).toBeVisible({ timeout: 5_000 })
  const backToOverview = dialog.getByRole('button', { name: 'Overview' })
  if (await backToOverview.count()) {
    await backToOverview.click()
  }
  await expect(dialog.getByTestId('context-overview-providers')).toBeVisible({ timeout: 5_000 })
  return dialog
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

async function upsertGlobalSkill(mainWindow: Page, content: string): Promise<void> {
  const dialog = await openGlobalContextManager(mainWindow)
  await dialog.getByTestId('context-overview-skills').click()
  await expect(dialog.getByTestId('context-new-skill')).toBeVisible({ timeout: 5_000 })

  const existing = dialog.getByTestId(`context-global-item-${skillSlug}`)
  if (await existing.count()) {
    await existing.first().click()
  } else {
    await dialog.getByTestId('context-new-skill').click()
    await expect(dialog.getByTestId('context-item-editor-slug')).toBeVisible({ timeout: 5_000 })
    await dialog.getByTestId('context-item-editor-slug').fill(skillSlug)
    await dialog.getByTestId('context-item-editor-slug').blur()
  }

  await dialog.getByTestId('context-item-editor-content').fill(content)
  await dialog.getByTestId('context-item-editor-content').blur()

  await expect.poll(async () => {
    return await mainWindow.evaluate(async (slug) => {
      const skills = await window.api.aiConfig.listItems({ scope: 'global', type: 'skill' })
      const match = skills.find((item) => item.slug === slug)
      return match?.content ?? null
    }, skillSlug)
  }).toBe(content)

  await dialog.getByTestId('context-item-editor-close').click()
  await closeTopDialog(mainWindow)
}

test.describe('Context manager sync flow', () => {
  let projectId: string

  test.beforeAll(async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const project = await s.createProject({ name: projectName, color: '#22c55e', path: TEST_PROJECT_PATH })
    projectId = project.id

    await mainWindow.evaluate(({ id }) => {
      return window.api.aiConfig.setProjectProviders(id, ['claude', 'codex'])
    }, { id: project.id })

    await s.refreshData()
    await goHome(mainWindow)
    await expect(projectBlob(mainWindow, projectAbbrev)).toBeVisible({ timeout: 5_000 })
  })

  test('creates a global skill file from the Files panel', async ({ mainWindow }) => {
    const slug = `e2e-global-file-${Date.now()}`
    const dialog = await openGlobalContextManager(mainWindow)
    await dialog.getByTestId('context-overview-files').click()

    const addButton = dialog.locator('[data-testid^="global-files-add-skill-"]').first()
    await expect(addButton).toBeVisible({ timeout: 5_000 })
    const addButtonTestId = await addButton.getAttribute('data-testid')
    if (!addButtonTestId) throw new Error('Expected global skill add button to have a data-testid')
    const provider = addButtonTestId.replace('global-files-add-skill-', '')
    await addButton.scrollIntoViewIfNeeded()
    await addButton.click()
    await dialog.getByTestId('global-files-new-name').fill(slug)
    await dialog.getByTestId('global-files-create').click()

    let createdPath: string | null = null
    await expect.poll(async () => {
      createdPath = await mainWindow.evaluate(async ({ candidate }) => {
        const files = await window.api.aiConfig.getGlobalFiles()
        const match = files.find((entry) =>
          entry.category === 'skill' &&
          entry.name.endsWith(`/${candidate}.md`)
        )
        return match?.path ?? null
      }, { candidate: slug })
      return createdPath ? 1 : 0
    }).toBe(1)

    if (createdPath) {
      await mainWindow.evaluate(async ({ filePath }) => {
        await window.api.aiConfig.deleteGlobalFile(filePath)
      }, { filePath: createdPath })
    }

    await closeTopDialog(mainWindow)
  })

  test('project MCP section shows provider columns when MCP entries exist', async ({ mainWindow }) => {
    await mainWindow.evaluate(({ id }) => {
      return window.api.aiConfig.setProjectProviders(id, ['claude', 'codex'])
    }, { id: projectId })

    const projectDialog = await openProjectContextSection(mainWindow, 'mcp')

    await expect(projectDialog.getByTestId('project-context-mcp-provider-claude')).toHaveCount(0)
    await expect(projectDialog.getByTestId('project-context-mcp-provider-codex')).toHaveCount(0)

    await projectDialog.getByText('Add MCP server').click()
    const addMcpDialog = mainWindow.getByRole('dialog').filter({ hasText: 'Add MCP Server' }).last()
    await expect(addMcpDialog).toBeVisible({ timeout: 5_000 })
    await addMcpDialog.getByRole('button', { name: 'Filesystem' }).click()

    await expect(projectDialog.getByTestId('project-context-mcp-provider-claude')).toBeVisible({ timeout: 5_000 })
    await expect(projectDialog.getByTestId('project-context-mcp-provider-codex')).toBeVisible({ timeout: 5_000 })

    await closeTopDialog(mainWindow)
  })

  test('global skill can be linked to project and re-synced after global edits', async ({ mainWindow }) => {
    await upsertGlobalSkill(mainWindow, skillContentV1)

    const projectDialog = await openProjectContextSection(mainWindow, 'skills')

    await projectDialog.getByTestId('project-context-add-skill').click()
    const addDialog = mainWindow.getByRole('dialog').filter({ hasText: 'Add Skill' }).last()
    await expect(addDialog).toBeVisible({ timeout: 5_000 })
    await addDialog.getByTestId(`add-item-option-${skillSlug}`).click()

    await expect.poll(() => fs.existsSync(claudeSkillPath())).toBe(true)
    await expect.poll(() => fs.existsSync(codexSkillPath())).toBe(true)
    await expect.poll(() => {
      try {
        const content = fs.readFileSync(claudeSkillPath(), 'utf-8')
        return content.includes(`name: ${skillSlug}`) && content.includes(skillContentV1.trim())
      } catch {
        return false
      }
    }).toBe(true)
    await expect.poll(() => {
      try {
        return fs.readFileSync(codexSkillPath(), 'utf-8')
      } catch {
        return ''
      }
    }).toBe(skillContentV1)

    await closeTopDialog(mainWindow)
    await upsertGlobalSkill(mainWindow, skillContentV2)

    const resyncDialog = await openProjectContextSection(mainWindow, 'skills')
    const skillRow = resyncDialog.getByTestId(`project-context-item-skill-${skillSlug}`)
    await expect(skillRow).toContainText('Stale', { timeout: 5_000 })

    await resyncDialog.getByRole('button', { name: 'Overview' }).click()
    await resyncDialog.getByTestId('project-context-sync-all').click()

    await expect.poll(() => {
      try {
        const content = fs.readFileSync(claudeSkillPath(), 'utf-8')
        return content.includes(`name: ${skillSlug}`) && content.includes(skillContentV2.trim())
      } catch {
        return false
      }
    }).toBe(true)
    await expect.poll(() => {
      try {
        return fs.readFileSync(codexSkillPath(), 'utf-8')
      } catch {
        return ''
      }
    }).toBe(skillContentV2)

    await expect.poll(async () => {
      return await mainWindow.evaluate(async ({ id, projectPath }) => {
        return window.api.aiConfig.needsSync(id, projectPath)
      }, { id: projectId, projectPath: TEST_PROJECT_PATH })
    }).toBe(false)

    await closeTopDialog(mainWindow)
  })

  test('project-local skill row has sync action', async ({ mainWindow }) => {
    await mainWindow.evaluate(async ({ id, slug, content }) => {
      const existing = await window.api.aiConfig.listItems({ scope: 'project', projectId: id, type: 'skill' })
      const match = existing.find((item) => item.slug === slug)
      if (match) {
        await window.api.aiConfig.updateItem({ id: match.id, content })
        return
      }
      await window.api.aiConfig.createItem({
        type: 'skill',
        scope: 'project',
        projectId: id,
        slug,
        content
      })
    }, { id: projectId, slug: localSkillSlug, content: localSkillContent })

    const projectDialog = await openProjectContextSection(mainWindow, 'skills')
    const skillRow = projectDialog.getByTestId(`project-context-item-skill-${localSkillSlug}`)
    await expect(skillRow).toBeVisible({ timeout: 5_000 })
    await skillRow.click()
    const pushAllButton = projectDialog.getByTestId(`skill-push-all-${localSkillSlug}`)
    await expect(pushAllButton).toBeVisible({ timeout: 5_000 })
    await pushAllButton.click()

    await expect.poll(() => fs.existsSync(localClaudeSkillPath())).toBe(true)
    await expect.poll(() => fs.existsSync(localCodexSkillPath())).toBe(true)
    await expect.poll(() => {
      try {
        const content = fs.readFileSync(localClaudeSkillPath(), 'utf-8')
        return content.includes(`name: ${localSkillSlug}`) && content.includes(localSkillContent.trim())
      } catch {
        return false
      }
    }).toBe(true)
    await expect.poll(() => {
      try {
        return fs.readFileSync(localCodexSkillPath(), 'utf-8')
      } catch {
        return ''
      }
    }).toBe(localSkillContent)

    await closeTopDialog(mainWindow)
  })

})
