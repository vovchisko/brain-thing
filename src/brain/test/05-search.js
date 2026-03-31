export default async function ({ post, assert }) {
  const { data } = await post('search', { filters: [{ field: 'project', value: 'TestProject' }] })
  assert(data.text.includes('Alpha'), 'Alpha found')
  assert(data.text.includes('Beta'), 'Beta found')
  assert(!data.text.includes('Gamma'), 'Gamma excluded')
}
