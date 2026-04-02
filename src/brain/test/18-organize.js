import { existsSync } from 'fs'
import { join } from 'path'

export default async function ({ post, assert, VAULT }) {
  // Project base folder
  await post('create', { name: 'Org Base', content: 'base test', tags: ['test'], project: 'TestProject' })
  assert(existsSync(join(VAULT, 'TestProject', 'Org Base.md')), 'project base folder')

  // Project subrule: tag test/docs → TestProject/Docs
  await post('create', { name: 'Org Docs', content: 'docs test', tags: ['test/docs'], project: 'TestProject' })
  assert(existsSync(join(VAULT, 'TestProject', 'Docs', 'Org Docs.md')), 'project tag subrule')

  // Project subrule: status=done → TestProject/Archive
  await post('create', { name: 'Org Done', content: 'done test', tags: ['test'], project: 'TestProject', status: 'done' })
  assert(existsSync(join(VAULT, 'TestProject', 'Archive', 'Org Done.md')), 'project field subrule')

  // Fallback rule: tag logs → Logs (no project)
  await post('create', { name: 'Org Log', content: 'log entry', tags: ['logs'] })
  assert(existsSync(join(VAULT, 'Logs', 'Org Log.md')), 'fallback rule')

  // No match → default folder
  await post('create', { name: 'Org Default', content: 'no match', tags: ['random'] })
  assert(existsSync(join(VAULT, 'Input', 'Org Default.md')), 'default folder')
}
