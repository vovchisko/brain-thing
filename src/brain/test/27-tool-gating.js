import { cfg }   from '../config.js'
import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, get, assert }) {
  // Disable the `get` tool
  cfg.vault.set({ tools: { [TOOLS.GET]: false } })

  // Disabled tool → soft refusal, handler never runs
  {
    const { data } = await post(TOOLS.GET, { name: 'Alpha' })
    assert(data.text.includes('disabled'), 'disabled tool refused softly')
  }

  // Other tools unaffected
  {
    const { data } = await post(TOOLS.LOOK_AROUND, {})
    assert(data.text.includes('Total:'), 'enabled tool still works')
  }

  // GET /tools reflects the flag
  {
    const { data } = await get('tools')
    assert(data.find(t => t.name === TOOLS.GET).enabled === false, 'get reported disabled')
    assert(data.find(t => t.name === TOOLS.SEARCH).enabled === true, 'search still enabled')
  }

  // Revert — tool works again
  cfg.vault.set({ tools: {} })
  {
    const { data } = await post(TOOLS.GET, { name: 'Alpha' })
    assert(!data.text.includes('is disabled'), 're-enabled tool works again')
  }
}
