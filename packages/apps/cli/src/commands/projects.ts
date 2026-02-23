import { Command } from 'commander'
import { openDb } from '../db'

interface ProjectRow extends Record<string, unknown> {
  id: string
  name: string
  path: string
  task_count: number
}

export function projectsCommand(): Command {
  const cmd = new Command('projects').description('Manage projects')

  // slay projects list
  cmd
    .command('list')
    .description('List all projects')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const db = openDb()

      const projects = db.query<ProjectRow>(
        `SELECT p.id, p.name, p.path,
           COUNT(t.id) FILTER (WHERE t.archived_at IS NULL AND t.is_temporary = 0) AS task_count
         FROM projects p
         LEFT JOIN tasks t ON t.project_id = p.id
         GROUP BY p.id
         ORDER BY p.name ASC`
      )

      if (opts.json) {
        console.log(JSON.stringify(projects, null, 2))
        return
      }

      if (projects.length === 0) {
        console.log('No projects found.')
        return
      }

      const idW = 9
      const nameW = 24
      console.log(`${'ID'.padEnd(idW)}  ${'NAME'.padEnd(nameW)}  TASKS  PATH`)
      console.log(`${'-'.repeat(idW)}  ${'-'.repeat(nameW)}  -----  ${'-'.repeat(30)}`)
      for (const p of projects) {
        const id = String(p.id).slice(0, 8).padEnd(idW)
        const name = String(p.name).slice(0, nameW).padEnd(nameW)
        const tasks = String(p.task_count).padStart(5)
        console.log(`${id}  ${name}  ${tasks}  ${p.path}`)
      }
    })

  return cmd
}
