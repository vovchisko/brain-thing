import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.GET, { name: 'Alpha' })
  assert(data.text.startsWith('=== [[Alpha]] ==='), 'identity on the === line')
  assert(data.text.includes('project: TestProject'), 'project in frontmatter')
  assert(!/^name:/m.test(data.text), 'name is not a frontmatter key')
  assert(!/wordCount/.test(data.text), 'computed wordCount hidden from frontmatter')
  assert(data.text.includes('Alpha content here'), 'body present')

  const { data: miss } = await post(TOOLS.GET, { name: 'Nonexistent' })
  assert(miss.text.includes('not found'), 'not found message')

  // Backlinks live under the === links === block (no inline meta, no word count, no [tags:])
  await post(TOOLS.CREATE, { name: 'Referencer', content: 'See [[Alpha]] for details.', attributes: { tags: ['test'], project: 'TestProject' } })
  const { data: bl } = await post(TOOLS.GET, { name: 'Alpha' })
  assert(bl.text.includes('=== links ==='), 'links block present')
  assert(/backlinks:\s+\[\[Referencer\]\]/.test(bl.text), 'backlink listed under backlinks:')
  assert(!/\[tags:/.test(bl.text), 'no [tags:] decoration on links')
  await post(TOOLS.DELETE, { name: 'Referencer' })

  // focus = body only (no frontmatter, no links)
  const { data: focus } = await post(TOOLS.GET, { name: 'Alpha', operation: 'focus' })
  assert(focus.text.startsWith('=== [[Alpha]] ==='), 'focus header')
  assert(focus.text.includes('Alpha content here'), 'focus has body')
  assert(!focus.text.includes('project: TestProject'), 'focus omits frontmatter')

  // estimate = frontmatter + word count, no body
  const { data: est } = await post(TOOLS.GET, { name: 'Alpha', operation: 'estimate' })
  assert(est.text.includes('project: TestProject'), 'estimate has frontmatter')
  assert(/\d+ words$/.test(est.text.trim()), 'estimate ends with a word count')
  assert(!est.text.includes('Alpha content here'), 'estimate omits the body')
}
