export default async function ({ post, assert }) {
  const { data } = await post('create', { name: 'Delta', content: 'New entry', tags: ['test'], project: 'TestProject' })
  assert(data.text.includes('Delta'), 'created Delta')

  const { data: check } = await post('get', { name: 'Delta' })
  assert(check.text.includes('project: TestProject'), 'project persisted')
}
