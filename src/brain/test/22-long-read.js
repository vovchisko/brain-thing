export default async function ({ post, assert }) {
  // --- estimate: compact list + totals ---
  {
    const { data } = await post('long_read', { operation: 'estimate', documents: ['Alpha', 'Beta', 'Delta'] })
    assert(data.text.startsWith('# Long read estimate:'), 'estimate header')
    assert(/3 entries/.test(data.text), 'counts 3 entries')
    assert(/\d+ words total/.test(data.text), 'shows total words')
    assert(data.text.includes('[[Alpha]]'), 'lists Alpha')
    assert(data.text.includes('[[Beta]]'), 'lists Beta')
    assert(!data.text.includes('Human edited'), 'no summary by default')  // Alpha summary mutated earlier in the test run
  }

  // --- estimate with summaries ---
  {
    const { data } = await post('long_read', { operation: 'estimate', documents: ['Alpha'], include_summary: true })
    assert(data.text.includes('Human edited'), 'summary included when include_summary=true')
  }

  // --- estimate: missing names are reported ---
  {
    const { data } = await post('long_read', { operation: 'estimate', documents: ['Alpha', 'NopeDoesNotExist'] })
    assert(data.text.includes('Not found'), 'missing section present')
    assert(data.text.includes('NopeDoesNotExist'), 'missing name listed')
  }

  // --- read: common fields hoisted, unique stay per entry ---
  {
    const { data } = await post('long_read', { operation: 'read', documents: ['Alpha', 'Beta'] })
    assert(data.text.startsWith('# Long read:'), 'read header')
    assert(data.text.includes('Project: TestProject'), 'shared project hoisted')
    assert(data.text.includes('Shared tags: test'), 'shared tag hoisted')  // both have 'test' tag
    assert(data.text.includes('=== [[Alpha]] ==='), 'Alpha section header')
    assert(data.text.includes('=== [[Beta]] ==='), 'Beta section header')
    assert(data.text.includes('Alpha content here'), 'Alpha content present')
    assert(data.text.includes('keyword final'), 'Beta content present (post-replace-test state)')
  }

  // --- read: marks all as seen, update works without explicit get ---
  {
    await post('create', { name: 'LRa', content: 'first', tags: ['test'], project: 'TestProject' })
    await post('create', { name: 'LRb', content: 'second', tags: ['test'], project: 'TestProject' })
    await post('long_read', { operation: 'read', documents: ['LRa', 'LRb'] })
    const { data: u } = await post('update', { name: 'LRa', fields: [{ property: 'state', value: 'checked' }] })
    assert(u.text.includes('Updated'), 'read marked LRa as seen — update succeeded without stale-check fail')
    await post('delete', { name: 'LRa' })
    await post('delete', { name: 'LRb' })
  }

  // --- read: all-missing error path ---
  {
    const { data } = await post('long_read', { operation: 'read', documents: ['Nope1', 'Nope2'] })
    assert(data.text.includes('No entries found'), 'all-missing message')
  }

  // --- bad operation → soft error text ---
  {
    const { data } = await post('long_read', { operation: 'wrong', documents: ['Alpha'] })
    assert(/operation must be/.test(data.text), 'bad operation returns clear message')
  }

  // --- empty documents → soft error text ---
  {
    const { data } = await post('long_read', { operation: 'read', documents: [] })
    assert(/non-empty array/.test(data.text), 'empty documents returns clear message')
  }
}
