import { writeFileSync } from 'fs'
import { join } from 'path'
import { server } from '../server.js'
import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert, VAULT }) {
  // Files dropped into the vault with non-string tag members (YAML number, date)
  // must not kill the rescan — t.startsWith crashed the whole organize pass.
  writeFileSync(join(VAULT, 'Garbage Tags.md'),
    '---\ntags:\n  - 123\n  - 2024-05-01\nsummary: "dropped in"\n---\njunk body')

  await server.hotSwap()

  const { data } = await post(TOOLS.GET, { name: 'Garbage Tags' })
  assert(!data.text.includes('failed to start'), `rescan survived garbage tags (got: ${ data.text.slice(0, 80) })`)
  assert(data.text.includes('junk body'), 'garbage entry imported')

  // tags_list does t.startsWith(prefix) — members must come out as strings
  const { data: tags } = await post(TOOLS.TAGS_LIST, {})
  assert(tags.text.includes('123'), 'numeric tag coerced to string')
  assert(tags.text.includes('2024-05-01'), 'date tag coerced to ISO date string')
}
