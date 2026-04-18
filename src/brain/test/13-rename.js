export default async function ({ post, assert }) {
  // Multiple referencing entries — exposes iterator-vs-mutation bugs during rename
  await post('create', { name: 'Ref One',   content: 'Points to [[Gamma]]',        tags: ['test'], project: 'TestProject' })
  await post('create', { name: 'Ref Two',   content: 'Also mentions [[Gamma]].',   tags: ['test'], project: 'TestProject' })
  await post('create', { name: 'Ref Three', content: 'Finally, [[Gamma]] again.',  tags: ['test'], project: 'TestProject' })

  // Rename Gamma
  const { data } = await post('rename', { name: 'Gamma', new_name: 'Gamma Renamed' })
  assert(data.text.includes('Renamed'), 'rename confirmed')
  assert(data.text.includes('3 references'), 'all 3 wikilink refs updated')

  // New name accessible
  const { data: check } = await post('get', { name: 'Gamma Renamed' })
  assert(check.text.includes('Gamma'), 'accessible by new name')

  // Old name gone
  const { data: old } = await post('get', { name: 'Gamma' })
  assert(old.text.includes('not found'), 'old name gone')

  // All three referencing entries updated
  for (const name of [ 'Ref One', 'Ref Two', 'Ref Three' ]) {
    const { data: ref } = await post('get', { name })
    assert(ref.text.includes('[[Gamma Renamed]]'), `${ name }: wikilink updated`)
    assert(!ref.text.includes('[[Gamma]]'), `${ name }: old wikilink gone`)
  }
}
