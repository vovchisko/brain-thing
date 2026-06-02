import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // Semantic search — always list, no auto full-entry
  const { data } = await post(TOOLS.WHAT_IS, { query: 'first test' })
  assert(data.text.includes('[[Alpha]]'), 'semantic match Alpha in list')
  assert(/words:\s*\d+/.test(data.text), 'list includes word count')
  assert(/\(\d+%\)/.test(data.text), 'list includes score percentage')
  assert(data.text.includes('`get`'), 'list hints at get for full content')
  assert(!data.text.includes('Alpha content here'), 'no full content inlined')

  // Project filter
  const { data: proj } = await post(TOOLS.WHAT_IS, { query: 'test', project: 'TestProject' })
  assert(!proj.text.includes('[[Gamma]]'), 'Gamma excluded by project')
  assert(!proj.text.includes('project: TestProject'), 'project hidden when filtered')

  // Exact name match also returns list (no full-entry shortcut)
  const { data: exact } = await post(TOOLS.WHAT_IS, { query: 'Alpha' })
  assert(exact.text.includes('[[Alpha]]'), 'Alpha in list for name query')
  assert(/\bwords:\s*\d+/.test(exact.text), 'exact-name list has word count')
  assert(!/^---\nname: Alpha/m.test(exact.text), 'no raw frontmatter dump')
}
