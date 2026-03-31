export default async function ({ post, assert }) {
  const { data } = await post('get', { name: 'Alpha' })
  assert(data.text.includes('Alpha'), 'found Alpha')
  assert(data.text.includes('project: TestProject'), 'project in output')

  const { data: miss } = await post('get', { name: 'Nonexistent' })
  assert(miss.text.includes('not found'), 'not found message')
}
