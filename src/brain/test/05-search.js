export default async function ({ post, assert }) {
  const { data } = await post('search', { filters: [{ field: 'project', value: 'TestProject' }] })
  assert(data.text.includes('[[Alpha]]'), 'Alpha found')
  assert(data.text.includes('[[Beta]]'), 'Beta found')
  assert(!data.text.includes('[[Gamma]]'), 'Gamma excluded')
  assert(/words:\s*\d+/.test(data.text), 'list includes word count')
  assert(data.text.includes('`get`'), 'hints at get for full content')
  assert(!data.text.includes('project: TestProject'), 'project hidden when filtered by it')
}
