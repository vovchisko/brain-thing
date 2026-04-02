export default async function ({ post, assert }) {
  // All issues
  const { data } = await post('diagnostic', {})
  assert(typeof data.text === 'string', 'returns text')

  // Project filter
  const { data: proj } = await post('diagnostic', { project: 'TestProject' })
  assert(typeof proj.text === 'string', 'project filter works')
  assert(!proj.text.includes('Gamma'), 'Gamma excluded from project diagnostic')

  // Category filter
  const { data: summary } = await post('diagnostic', { category: 'summary' })
  assert(typeof summary.text === 'string', 'category filter works')

  // Tags filter
  const { data: tags } = await post('diagnostic', { tags: ['other'] })
  assert(typeof tags.text === 'string', 'tags filter works')
}
