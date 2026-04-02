export default async function ({ post, assert }) {
  // Must read before write
  await post('get', { name: 'Alpha' })
  const { data } = await post('update', { name: 'Alpha', fields: [{ property: 'summary', value: 'Updated summary' }] })
  assert(data.text.includes('Updated'), 'update confirmed')

  const { data: check } = await post('get', { name: 'Alpha' })
  assert(check.text.includes('Updated summary'), 'summary changed')
  assert(check.text.includes('project: TestProject'), 'project preserved')

  // Without prior get → should be rejected
  const { data: stale } = await post('update', { name: 'Beta', fields: [{ property: 'summary', value: 'sneaky' }] })
  assert(stale.text.includes('must be read'), 'rejected without prior get')
}
