import { cfg }            from '../config.js'
import { ATTRIBUTE_TYPE } from '../../shared/attribute-types.js'
import { TOOLS }          from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // Add a custom number attribute — the type-mismatch tests below need it
  const currentAttributes = cfg.vault.get().attributes
  cfg.vault.set({
    attributes: [
      ...currentAttributes,
      { name: 'priority', type: ATTRIBUTE_TYPE.NUMBER, desc: 'Priority level' },
    ],
  })

  // --- search: unsupported op on string → gentle error ---
  {
    const { data } = await post(TOOLS.SEARCH, { filters: [{ attribute: 'summary', value: 'x', op: '$gt' }] })
    assert(data.text.includes('not supported'), 'search soft-errors on bad op')
    assert(data.text.includes('$eq'), 'search suggests allowed ops')
  }

  // --- search: unknown attribute → gentle error ---
  {
    const { data } = await post(TOOLS.SEARCH, { filters: [{ attribute: 'definitely_not_an_attribute_xyz', value: 'x' }] })
    assert(data.text.includes('not found'), 'search soft-errors on unknown attribute')
  }

  // --- create: type mismatch produces warning, not failure ---
  {
    const { data } = await post(TOOLS.CREATE, {
      name: 'TypeCheck',
      content: 'body',
      attributes: { tags: ['test'], project: 'TestProject', priority: 'not-a-number' },
    })
    assert(data.text.startsWith('Created'), 'create succeeded despite bad type')
    assert(data.text.includes('Warnings'), 'create included warnings section')
    assert(data.text.includes('priority'), 'warning names the field')
  }

  // --- edit: type mismatch produces warning ---
  {
    await post(TOOLS.GET, { name: 'TypeCheck' })
    const { data } = await post(TOOLS.EDIT, {
      name: 'TypeCheck',
      attributes: { priority: 'still-not-a-number' },
    })
    assert(data.text.startsWith('Edited'), 'edit succeeded despite bad type')
    assert(data.text.includes('Warnings'), 'edit included warnings section')
  }

  // Cleanup: revert attributes
  cfg.vault.set({ attributes: currentAttributes })
}
