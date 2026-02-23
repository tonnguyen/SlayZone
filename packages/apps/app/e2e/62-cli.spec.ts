import { test, expect, seed, clickProject, goHome, TEST_PROJECT_PATH } from './fixtures/electron'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SLAY_JS = path.resolve(__dirname, '..', '..', 'cli', 'dist', 'slay.js')

test.describe('CLI: slay', () => {
  let dbPath = ''
  let projectId = ''
  const PROJECT_ABBREV = 'CL'

  test.beforeAll(async ({ electronApp, mainWindow }) => {
    if (!fs.existsSync(SLAY_JS)) {
      throw new Error(`CLI not built. Run: pnpm --filter @slayzone/cli build\nExpected: ${SLAY_JS}`)
    }

    // Get the exact DB path the running app is using
    const dbDir = await electronApp.evaluate(() => process.env.SLAYZONE_DB_DIR!)
    // Tests always run non-packaged, so DB name is always slayzone.dev.sqlite
    dbPath = path.join(dbDir, 'slayzone.dev.sqlite')

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'CLI Test', color: '#10b981', path: TEST_PROJECT_PATH })
    projectId = p.id

    await s.createTask({ projectId, title: 'CLI seeded todo task', status: 'todo' })
    await s.createTask({ projectId, title: 'CLI seeded done task', status: 'done' })
    await s.createTask({ projectId, title: 'CLI seeded in progress task', status: 'in_progress' })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, PROJECT_ABBREV)
  })

  const runCli = (...args: string[]) =>
    spawnSync('node', [SLAY_JS, ...args], {
      env: { ...process.env, SLAYZONE_DB_PATH: dbPath },
      encoding: 'utf8',
    })

  // --- slay tasks list ---

  test.describe('slay tasks list', () => {
    test('lists all tasks', () => {
      const r = runCli('tasks', 'list')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('CLI seeded todo task')
      expect(r.stdout).toContain('CLI seeded done task')
      expect(r.stdout).toContain('CLI seeded in progress task')
    })

    test('--status filters tasks', () => {
      const r = runCli('tasks', 'list', '--status', 'todo')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('CLI seeded todo task')
      expect(r.stdout).not.toContain('CLI seeded in progress task')
    })

    test('--done shows only done tasks', () => {
      const r = runCli('tasks', 'list', '--done')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('CLI seeded done task')
      expect(r.stdout).not.toContain('CLI seeded todo task')
    })

    test('--project filters by project name', () => {
      const r = runCli('tasks', 'list', '--project', 'cli test')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('CLI seeded todo task')
    })

    test('--json outputs valid JSON array', () => {
      const r = runCli('tasks', 'list', '--json')
      expect(r.status).toBe(0)
      const tasks = JSON.parse(r.stdout)
      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks.some((t: { title: string }) => t.title === 'CLI seeded todo task')).toBe(true)
    })

    test('--limit caps results', () => {
      const r = runCli('tasks', 'list', '--json', '--limit', '1')
      expect(r.status).toBe(0)
      const tasks = JSON.parse(r.stdout)
      expect(tasks).toHaveLength(1)
    })
  })

  // --- slay tasks create ---

  test.describe('slay tasks create', () => {
    test('creates task and UI updates automatically via file watcher', async ({ mainWindow }) => {
      const title = `CLI created ${Date.now()}`
      const r = runCli('tasks', 'create', title, '--project', 'cli test')
      expect(r.status).toBe(0)

      // File watcher fires → refreshData → React re-renders — no manual refresh needed
      await expect(mainWindow.getByText(title)).toBeVisible({ timeout: 5_000 })
    })

    test('exits non-zero and mentions --project when flag is missing', () => {
      const r = runCli('tasks', 'create', 'No project task')
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('--project')
    })
  })

  // --- slay projects list ---

  test.describe('slay projects list', () => {
    test('lists projects with task counts', () => {
      const r = runCli('projects', 'list')
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('CLI Test')
    })

    test('--json outputs valid JSON array', () => {
      const r = runCli('projects', 'list', '--json')
      expect(r.status).toBe(0)
      const projects = JSON.parse(r.stdout)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects.some((p: { name: string }) => p.name === 'CLI Test')).toBe(true)
    })
  })

  // --- slay tasks update ---

  test.describe('slay tasks update', () => {
    test('updates task title', () => {
      const r0 = runCli('tasks', 'list', '--project', 'cli test', '--json')
      const tasks = JSON.parse(r0.stdout)
      const task = tasks.find((t: { title: string }) => t.title === 'CLI seeded todo task')
      const r = runCli('tasks', 'update', task.id.slice(0, 8), '--title', 'CLI renamed task')
      expect(r.status).toBe(0)
      const r2 = runCli('tasks', 'list', '--json')
      expect(JSON.parse(r2.stdout).some((t: { title: string }) => t.title === 'CLI renamed task')).toBe(true)
    })

    test('updates task status', () => {
      const r0 = runCli('tasks', 'list', '--json')
      const tasks = JSON.parse(r0.stdout)
      const task = tasks.find((t: { title: string }) => t.title === 'CLI seeded in progress task')
      const r = runCli('tasks', 'update', task.id.slice(0, 8), '--status', 'review')
      expect(r.status).toBe(0)
      const r2 = runCli('tasks', 'list', '--status', 'review', '--json')
      expect(JSON.parse(r2.stdout).some((t: { title: string }) => t.title === 'CLI seeded in progress task')).toBe(true)
    })

    test('exits non-zero with no options', () => {
      const r = runCli('tasks', 'update', 'xxxxxxxx')
      expect(r.status).not.toBe(0)
    })

    test('exits non-zero on unknown id prefix', () => {
      const r = runCli('tasks', 'update', 'xxxxxxxx', '--status', 'todo')
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('not found')
    })
  })

  // --- slay tasks archive ---

  test.describe('slay tasks archive', () => {
    test('archives task and it disappears from list', () => {
      const title = `CLI archive test ${Date.now()}`
      runCli('tasks', 'create', title, '--project', 'cli test')
      const r0 = runCli('tasks', 'list', '--json')
      const task = JSON.parse(r0.stdout).find((t: { title: string }) => t.title === title)
      expect(task).toBeDefined()

      const r = runCli('tasks', 'archive', task.id.slice(0, 8))
      expect(r.status).toBe(0)

      const r2 = runCli('tasks', 'list', '--json')
      expect(JSON.parse(r2.stdout).some((t: { title: string }) => t.title === title)).toBe(false)
    })
  })

  // --- slay tasks delete ---

  test.describe('slay tasks delete', () => {
    test('deletes task permanently', () => {
      const title = `CLI delete test ${Date.now()}`
      runCli('tasks', 'create', title, '--project', 'cli test')
      const r0 = runCli('tasks', 'list', '--json')
      const task = JSON.parse(r0.stdout).find((t: { title: string }) => t.title === title)
      expect(task).toBeDefined()

      const r = runCli('tasks', 'delete', task.id.slice(0, 8))
      expect(r.status).toBe(0)

      const r2 = runCli('tasks', 'list', '--json')
      expect(JSON.parse(r2.stdout).some((t: { title: string }) => t.title === title)).toBe(false)
    })

    test('exits non-zero on unknown id prefix', () => {
      const r = runCli('tasks', 'delete', 'xxxxxxxx')
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('not found')
    })
  })

  // --- slay tasks open ---

  test.describe('slay tasks open', () => {
    test('outputs Opening: for a valid task id', () => {
      const r0 = runCli('tasks', 'list', '--json')
      const tasks = JSON.parse(r0.stdout)
      const task = tasks[0]
      const r = runCli('tasks', 'open', task.id.slice(0, 8))
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('Opening:')
    })

    test('exits non-zero on unknown id prefix', () => {
      const r = runCli('tasks', 'open', 'xxxxxxxx')
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('not found')
    })
  })

  // --- slay tasks done ---

  test.describe('slay tasks done', () => {
    test('marks task done and UI updates automatically via file watcher', async ({ mainWindow }) => {
      const s = seed(mainWindow)
      const task = await s.createTask({ projectId, title: 'Task to complete via CLI', status: 'todo' })
      await s.refreshData()
      // Locate the todo column by its w-72 class + heading; task should be visible there
      const todoCol = mainWindow.locator('div.w-72').filter({ has: mainWindow.locator('h3', { hasText: 'Todo' }) })
      await expect(todoCol.getByText('Task to complete via CLI')).toBeVisible({ timeout: 5_000 })

      const r = runCli('tasks', 'done', task.id.slice(0, 8))
      expect(r.status).toBe(0)

      // File watcher fires → refreshData → task moves from todo to done column
      await expect(todoCol.getByText('Task to complete via CLI')).not.toBeVisible({ timeout: 5_000 })
    })

    test('exits non-zero on unknown id prefix', () => {
      const r = runCli('tasks', 'done', 'xxxxxxxx')
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('not found')
    })
  })
})
