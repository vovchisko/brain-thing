export default async function ({ post, assert }) {
  const { data } = await post('grep', { text: 'findme' })
  assert(data.text.includes('Beta'), 'found by content')

  const { data: filtered } = await post('grep', { text: 'entry', project: 'TestProject' })
  assert(filtered.text.includes('Alpha'), 'Alpha in project')
  assert(filtered.text.includes('Beta'), 'Beta in project')
  assert(!filtered.text.includes('Gamma'), 'Gamma excluded')
}
