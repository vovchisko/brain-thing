import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // All issues
  const { data } = await post(TOOLS.DIAGNOSTIC, {})
  assert(typeof data.text === 'string', 'returns text')

  // Project filter
  const { data: proj } = await post(TOOLS.DIAGNOSTIC, { project: 'TestProject' })
  assert(typeof proj.text === 'string', 'project filter works')
  assert(!proj.text.includes('Gamma'), 'Gamma excluded from project diagnostic')

  // Category filter
  const { data: summary } = await post(TOOLS.DIAGNOSTIC, { category: 'summary' })
  assert(typeof summary.text === 'string', 'category filter works')

  // Tags filter
  const { data: tags } = await post(TOOLS.DIAGNOSTIC, { tags: ['other'] })
  assert(typeof tags.text === 'string', 'tags filter works')
}
