import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // --- estimate: total line + per-doc frontmatter + word counts (get-estimate repeated) ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'estimate', documents: ['Alpha', 'Beta', 'Delta'] })
    assert(/^\d+ words across 3 docs/.test(data.text), 'estimate leads with a plain total line')
    assert(data.text.includes('=== [[Alpha]] ==='), 'lists Alpha')
    assert(data.text.includes('=== [[Beta]] ==='), 'lists Beta')
    assert(/\d+ words/.test(data.text), 'shows per-doc word count')
    assert(data.text.includes('Human edited'), 'summary carried via frontmatter (Alpha summary mutated earlier)')
    assert(!data.text.includes('Alpha content here'), 'estimate omits bodies')
  }

  // --- estimate: missing names are reported ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'estimate', documents: ['Alpha', 'NopeDoesNotExist'] })
    assert(data.text.includes('Not found'), 'missing section present')
    assert(data.text.includes('NopeDoesNotExist'), 'missing name listed')
  }

  // --- read: get repeated — per-doc frontmatter + body, no top header, no factoring ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'read', documents: ['Alpha', 'Beta'] })
    assert(data.text.startsWith('=== [[Alpha]] ==='), 'starts with first doc header, no top banner')
    assert(data.text.includes('project: TestProject'), 'per-doc project in frontmatter (not hoisted)')
    assert(data.text.includes('=== [[Beta]] ==='), 'Beta section header')
    assert(data.text.includes('Alpha content here'), 'Alpha content present')
    assert(data.text.includes('keyword final'), 'Beta content present (post-replace-test state)')
  }

  // --- focus: bodies only ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'focus', documents: ['Alpha', 'Beta'] })
    assert(data.text.includes('=== [[Alpha]] ==='), 'focus keeps doc headers')
    assert(data.text.includes('Alpha content here'), 'focus has body')
    assert(!data.text.includes('project: TestProject'), 'focus omits frontmatter')
  }

  // --- read: marks all as seen, update works without explicit get ---
  {
    await post(TOOLS.CREATE, { name: 'LRa', content: 'first', attributes: { tags: ['test'], project: 'TestProject' } })
    await post(TOOLS.CREATE, { name: 'LRb', content: 'second', attributes: { tags: ['test'], project: 'TestProject' } })
    await post(TOOLS.LONG_READ, { operation: 'read', documents: ['LRa', 'LRb'] })
    const { data: u } = await post(TOOLS.EDIT, { name: 'LRa', attributes: { state: 'checked' } })
    assert(u.text.includes('Edited'), 'read marked LRa as seen — edit succeeded without stale-check fail')
    await post(TOOLS.DELETE, { name: 'LRa' })
    await post(TOOLS.DELETE, { name: 'LRb' })
  }

  // --- read: all-missing error path ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'read', documents: ['Nope1', 'Nope2'] })
    assert(data.text.includes('No entries found'), 'all-missing message')
  }

  // --- bad operation → soft error text ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'wrong', documents: ['Alpha'] })
    assert(/operation must be/.test(data.text), 'bad operation returns clear message')
  }

  // --- empty documents → soft error text ---
  {
    const { data } = await post(TOOLS.LONG_READ, { operation: 'read', documents: [] })
    assert(/non-empty array/.test(data.text), 'empty documents returns clear message')
  }
}
