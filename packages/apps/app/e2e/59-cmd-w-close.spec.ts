import { test, expect, seed, goHome, clickProject } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'
import type { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Simulate the menu accelerator click by sending IPC directly from the main process.
// This is more reliable than keyboard.press for native menu accelerators in Playwright.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendIPC(electronApp: any, channel: string): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }: { BrowserWindow: typeof Electron.CrossProcessExports.BrowserWindow }, ch: string) => {
      BrowserWindow.getAllWindows()
        .find((w) => !w.isDestroyed() && !w.webContents.getURL().startsWith('data:'))
        ?.webContents.send(ch)
    },
    channel
  )
}

test.describe('Cmd+W / Cmd+Shift+W context-sensitive close', () => {
  let projectAbbrev: string

  /** All terminal group tabs in the visible terminal tab bar */
  const terminalGroupTabs = (page: Page) =>
    page.locator('[data-testid="terminal-tabbar"]:visible [data-tab-main]')

  /** Editor file tab button by filename suffix */
  const editorTab = (page: Page, name: string) =>
    page.locator(`button[title$="${name}"]:visible`).first()

  /** Browser panel URL input */
  const urlInput = (page: Page) =>
    page.locator('input[placeholder="Enter URL..."]:visible').first()

  /** Browser tab entries (excludes the + button) */
  const browserTabEntries = (page: Page) =>
    page.locator('.h-10.overflow-x-auto:visible [role="button"]:not(:has(.lucide-plus))')

  /** Focus the xterm textarea in the currently visible terminal */
  const focusTerminal = (page: Page) =>
    page.evaluate(() => {
      const textareas = document.querySelectorAll<HTMLElement>('.xterm-helper-textarea')
      for (const ta of textareas) {
        if (!ta.closest('.hidden')) { ta.focus(); break }
      }
    })

  test.beforeAll(async ({ mainWindow }) => {
    fs.writeFileSync(path.join(TEST_PROJECT_PATH, 'cmdw.ts'), 'const x = 1\n')

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'CmdW Test', color: '#6366f1', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'CmdW task', status: 'in_progress' })
    await s.refreshData()

    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await mainWindow.getByText('CmdW task').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible({ timeout: 5_000 })
  })

  // ── Terminal group tabs ──────────────────────────────────────────────────

  test('Cmd+W closes extra terminal group when terminal is focused', async ({ mainWindow, electronApp }) => {
    await expect(terminalGroupTabs(mainWindow)).toHaveCount(1, { timeout: 3_000 })

    // Add a new terminal group via the + button
    await mainWindow.locator('[data-testid="terminal-tabbar"]:visible [data-testid="terminal-tab-add"]').first().click()
    await expect(terminalGroupTabs(mainWindow)).toHaveCount(2, { timeout: 3_000 })

    // Activate the non-main group
    await mainWindow.locator('[data-testid="terminal-tabbar"]:visible [data-tab-main="false"]').first().click()

    await focusTerminal(mainWindow)
    await sendIPC(electronApp, 'app:close-current-focus')

    await expect(terminalGroupTabs(mainWindow)).toHaveCount(1, { timeout: 3_000 })
  })

  test('Cmd+W does not close the main (only) terminal group', async ({ mainWindow, electronApp }) => {
    await expect(terminalGroupTabs(mainWindow)).toHaveCount(1, { timeout: 2_000 })

    await focusTerminal(mainWindow)
    await sendIPC(electronApp, 'app:close-current-focus')

    // Still 1 group — main group is protected
    await expect(terminalGroupTabs(mainWindow)).toHaveCount(1, { timeout: 2_000 })
  })

  // ── Editor file tabs ─────────────────────────────────────────────────────

  test('Cmd+W closes active editor file when editor is focused', async ({ mainWindow, electronApp }) => {
    // Open editor panel
    await mainWindow.keyboard.press('Meta+e')
    const editorPanel = mainWindow.locator('.rounded-md.bg-surface-1:visible').filter({ hasText: 'Files' })
    await expect(editorPanel).toBeVisible({ timeout: 5_000 })

    // Open a file
    await editorPanel.locator('button.w-full:has-text("cmdw.ts")').first().click()
    await expect(editorTab(mainWindow, 'cmdw.ts')).toBeVisible({ timeout: 3_000 })

    // Focus the CodeMirror editor
    await mainWindow.locator('.cm-editor:visible .cm-content').click()

    await sendIPC(electronApp, 'app:close-current-focus')

    await expect(editorTab(mainWindow, 'cmdw.ts')).not.toBeVisible({ timeout: 3_000 })
  })

  // ── Browser tabs ─────────────────────────────────────────────────────────

  test('Cmd+W closes extra browser tab when browser is focused', async ({ mainWindow, electronApp }) => {
    // Ensure browser panel is open
    if (!(await urlInput(mainWindow).isVisible().catch(() => false))) {
      await mainWindow.keyboard.press('Escape').catch(() => {})
      await mainWindow.locator('#root').click({ position: { x: 12, y: 12 } }).catch(() => {})
      await mainWindow.keyboard.press('Meta+b')
      await expect(urlInput(mainWindow)).toBeVisible({ timeout: 5_000 })
    }

    const initial = await browserTabEntries(mainWindow).count()

    // Add a new browser tab via the + button
    await mainWindow.locator('.h-10.overflow-x-auto:visible button:has(.lucide-plus)').first().click()
    await expect(browserTabEntries(mainWindow)).toHaveCount(initial + 1, { timeout: 3_000 })

    // Focus the URL bar (inside [data-browser-panel])
    await urlInput(mainWindow).click()

    await sendIPC(electronApp, 'app:close-current-focus')

    await expect(browserTabEntries(mainWindow)).toHaveCount(initial, { timeout: 3_000 })
  })

  test('Cmd+W does not close the last browser tab', async ({ mainWindow, electronApp }) => {
    const count = await browserTabEntries(mainWindow).count()

    await urlInput(mainWindow).click()
    await sendIPC(electronApp, 'app:close-current-focus')

    await expect(browserTabEntries(mainWindow)).toHaveCount(count, { timeout: 2_000 })
  })

  // ── Task tab ─────────────────────────────────────────────────────────────

  test('Cmd+Shift+W closes the active task tab', async ({ mainWindow, electronApp }) => {
    // Ensure the CmdW task tab is active
    await mainWindow.getByText('CmdW task').first().click()
    await expect(mainWindow.locator('[data-testid="terminal-mode-trigger"]:visible').first()).toBeVisible({ timeout: 5_000 })

    await sendIPC(electronApp, 'app:close-active-task')

    // Title input for "CmdW task" should no longer be visible
    await expect(async () => {
      const title = await mainWindow.evaluate(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('input')
        for (const input of inputs) {
          if (input.offsetParent !== null && input.value) return input.value
        }
        return null
      })
      expect(title).not.toBe('CmdW task')
    }).toPass({ timeout: 3_000 })
  })
})
