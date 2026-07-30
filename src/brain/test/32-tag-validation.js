import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // MCP writes must reject malformed tags loudly — the vault once accumulated
  // "eow/novel/function - Notes" as a single tag. Watcher ingestion stays
  // tolerant (31-garbage-tags); tool input does not.
  const spaced = await post(TOOLS.CREATE, { name: 'TagGuard', content: 'x', attributes: { tags: ['eow/novel/function - Notes'] } })
  assert(spaced.data.text.includes('eow/novel/function - Notes'), 'create: error names the offending tag')
  assert(spaced.data.text.includes('a-z0-9_-'), 'create: error states the format rule')

  const upper = await post(TOOLS.CREATE, { name: 'TagGuard', content: 'x', attributes: { tags: ['EOW/Core'] } })
  assert(upper.data.text.includes('EOW/Core'), 'create: uppercase rejected')

  const shapes = await post(TOOLS.CREATE, { name: 'TagGuard', content: 'x', attributes: { tags: ['ok', '/lead', 'trail/', 'a//b', '', 123] } })
  for (const t of ['"/lead"', '"trail/"', '"a//b"', '""', '"123"']) {
    assert(shapes.data.text.includes(t), `create: ${ t } listed as offender`)
  }
  assert(!shapes.data.text.includes('"ok"'), 'create: valid tag not listed as offender')

  const good = await post(TOOLS.CREATE, { name: 'TagGuard', content: 'x', attributes: { tags: ['test/sub-2', 'my_tag'] } })
  assert(good.data.text.includes('Created'), 'create: valid tags pass')

  const badEdit = await post(TOOLS.EDIT, { name: 'TagGuard', attributes: { tags: ['bad tag'] } })
  assert(badEdit.data.text.includes('bad tag'), 'edit: error names the offending tag')
  assert(badEdit.data.text.includes('a-z0-9_-'), 'edit: error states the format rule')

  const goodEdit = await post(TOOLS.EDIT, { name: 'TagGuard', attributes: { tags: ['test/renamed'] } })
  assert(goodEdit.data.text.includes('Edited'), 'edit: valid tags pass')
}
