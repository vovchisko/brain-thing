export default async function ({ post, assert }) {
  // Create entry with wikilink to Gamma
  await post('create', { name: 'Ref Entry', content: 'Points to [[Gamma]]', tags: ['test'], project: 'TestProject' })

  // Rename Gamma
  const { data } = await post('rename', { name: 'Gamma', new_name: 'Gamma Renamed' })
  assert(data.text.includes('Renamed'), 'rename confirmed')
  assert(data.text.includes('1 references'), 'wikilink ref updated')

  // New name accessible
  const { data: check } = await post('get', { name: 'Gamma Renamed' })
  assert(check.text.includes('Gamma'), 'accessible by new name')

  // Old name gone
  const { data: old } = await post('get', { name: 'Gamma' })
  assert(old.text.includes('not found'), 'old name gone')

  // Wikilink in referencing entry updated
  const { data: ref } = await post('get', { name: 'Ref Entry' })
  assert(ref.text.includes('[[Gamma Renamed]]'), 'wikilink updated in referencing entry')
  assert(!ref.text.includes('[[Gamma]]'), 'old wikilink gone')
}
