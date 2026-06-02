import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // Multiple referencing entries — exposes iterator-vs-mutation bugs during rename
  await post(TOOLS.CREATE, { name: 'Ref One',   content: 'Points to [[Gamma]]',       attributes: { tags: ['test'], project: 'TestProject' } })
  await post(TOOLS.CREATE, { name: 'Ref Two',   content: 'Also mentions [[Gamma]].',  attributes: { tags: ['test'], project: 'TestProject' } })
  await post(TOOLS.CREATE, { name: 'Ref Three', content: 'Finally, [[Gamma]] again.', attributes: { tags: ['test'], project: 'TestProject' } })

  // Rename Gamma
  const { data } = await post(TOOLS.RENAME, { name: 'Gamma', new_name: 'Gamma Renamed' })
  assert(data.text.includes('Renamed'), 'rename confirmed')
  assert(data.text.includes('3 references'), 'all 3 wikilink refs updated')

  // New name accessible
  const { data: check } = await post(TOOLS.GET, { name: 'Gamma Renamed' })
  assert(check.text.includes('Gamma'), 'accessible by new name')

  // Old name gone
  const { data: old } = await post(TOOLS.GET, { name: 'Gamma' })
  assert(old.text.includes('not found'), 'old name gone')

  // All three referencing entries updated
  for (const name of [ 'Ref One', 'Ref Two', 'Ref Three' ]) {
    const { data: ref } = await post(TOOLS.GET, { name })
    assert(ref.text.includes('[[Gamma Renamed]]'), `${ name }: wikilink updated`)
    assert(!ref.text.includes('[[Gamma]]'), `${ name }: old wikilink gone`)
  }
}
