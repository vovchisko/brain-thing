export default async function ({ post, assert }) {
  const { data } = await post('update', { name: 'Alpha', fields: [{ property: 'summary', value: 'Updated summary' }] })
  assert(data.text.includes('Updated'), 'update confirmed')

  const { data: check } = await post('get', { name: 'Alpha' })
  assert(check.text.includes('Updated summary'), 'summary changed')
  assert(check.text.includes('project: TestProject'), 'project preserved')
}
