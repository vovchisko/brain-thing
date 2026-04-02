import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export default async function ({ post, assert, sleep, VAULT }) {
  // Read before write
  await post('get', { name: 'Alpha' })
  await post('update', { name: 'Alpha', fields: [{ property: 'summary', value: 'AI updated' }] })
  const { data: before } = await post('get', { name: 'Alpha' })
  assert(before.text.includes('AI updated'), 'API update applied')

  // Wait for watcher debounce
  await sleep(1000)

  // Entry unchanged after watcher — content_hash skip worked
  const { data: after } = await post('get', { name: 'Alpha' })
  assert(after.text.includes('AI updated'), 'still correct after watcher')

  // User edit on disk → watcher picks it up
  const filePath = join(VAULT, 'TestProject', 'Alpha.md')
  const raw = readFileSync(filePath, 'utf-8')
  const edited = raw.replace('AI updated', 'Human edited')
  writeFileSync(filePath, edited, 'utf-8')

  await sleep(1000)

  const { data: userEdit } = await post('get', { name: 'Alpha' })
  assert(userEdit.text.includes('Human edited'), 'watcher picked up user edit')
}
