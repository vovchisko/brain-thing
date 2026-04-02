export default async function ({ post, assert }) {
  // Semantic search
  const { data } = await post('what_is', { query: 'first test' })
  assert(data.text.includes('Alpha'), 'semantic match Alpha')

  // Project filter
  const { data: proj } = await post('what_is', { query: 'test', project: 'TestProject' })
  assert(!proj.text.includes('Gamma'), 'Gamma excluded by project')

  // Exact name match → full entry with frontmatter
  const { data: exact } = await post('what_is', { query: 'Alpha' })
  assert(exact.text.includes('project: TestProject'), 'exact match returns frontmatter')
  assert(exact.text.includes('Alpha content'), 'exact match returns content')
}
