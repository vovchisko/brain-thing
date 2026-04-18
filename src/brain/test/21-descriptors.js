import { cfg } from '../config.js'

export default async function ({ post, get, assert }) {
  // --- Augmented tool descriptions: write-scope excludes created/modified ---
  {
    const { data: tools } = await get('tools')
    const create = tools.find(t => t.name === 'create')
    assert(create, 'create tool listed')
    assert(create.description.includes('Known fields'), 'create has Known fields header')
    assert(create.description.includes('- project (string)'), 'create lists project')
    assert(create.description.includes('- tags (list)'), 'create lists tags')
    assert(!/- created \(/.test(create.description), 'create omits created (auto-managed)')
    assert(!/- modified \(/.test(create.description), 'create omits modified (auto-managed)')

    const search = tools.find(t => t.name === 'search')
    assert(search.description.includes('Searchable fields'), 'search has Searchable fields header')
    assert(/- created \(date\)/.test(search.description), 'search lists created')
    assert(/- modified \(date\)/.test(search.description), 'search lists modified')
  }

  // --- Dynamic: add a custom field, augmented description must reflect it ---
  const currentFields = cfg.vault.get().fields
  cfg.vault.set({
    fields: [
      ...currentFields,
      { name: 'priority', type: 'number', desc: 'Priority level' },
      { name: 'narrate', type: 'string', desc: 'TTS collection', feature: 'tts' },
    ],
  })
  {
    const { data: tools } = await get('tools')
    const create = tools.find(t => t.name === 'create')
    assert(/- priority \(number\)/.test(create.description), 'create reflects newly added priority field')
    assert(!/- narrate \(/.test(create.description), 'create hides narrate (tts feature disabled)')
  }

  // --- search: unsupported op on string → gentle error ---
  {
    const { data } = await post('search', { filters: [{ field: 'summary', value: 'x', op: '$gt' }] })
    assert(data.text.includes('not supported'), 'search soft-errors on bad op')
    assert(data.text.includes('$eq'), 'search suggests allowed ops')
  }

  // --- search: unknown field → gentle error ---
  {
    const { data } = await post('search', { filters: [{ field: 'definitely_not_a_field_xyz', value: 'x' }] })
    assert(data.text.includes('not found'), 'search soft-errors on unknown field')
  }

  // --- create: type mismatch produces warning, not failure ---
  {
    const { data } = await post('create', {
      name: 'TypeCheck',
      content: 'body',
      tags: ['test'],
      project: 'TestProject',
      priority: 'not-a-number',
    })
    assert(data.text.startsWith('Created'), 'create succeeded despite bad type')
    assert(data.text.includes('Warnings'), 'create included warnings section')
    assert(data.text.includes('priority'), 'warning names the field')
  }

  // --- update: type mismatch produces warning ---
  {
    await post('get', { name: 'TypeCheck' })
    const { data } = await post('update', {
      name: 'TypeCheck',
      fields: [{ property: 'priority', value: 'still-not-a-number' }],
    })
    assert(data.text.startsWith('Updated'), 'update succeeded despite bad type')
    assert(data.text.includes('Warnings'), 'update included warnings section')
  }

  // Cleanup: revert fields
  cfg.vault.set({ fields: currentFields })
}
