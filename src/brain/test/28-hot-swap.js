import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cfg } from '../config.js'
import { server } from '../server.js'
import { TOOLS } from '../../shared/specs.js'

const BRAIN_DIR = dirname(fileURLToPath(import.meta.url))
const ALT_VAULT = join(BRAIN_DIR, '..', '_test-env', 'alt-vault')

export default async function ({ post, assert }) {
  // 1. Read Alpha in the current vault → markSeen stores its hash
  await post(TOOLS.GET, { name: 'Alpha' })

  // 2. Build a second vault with a same-named entry of different content
  rmSync(ALT_VAULT, { recursive: true, force: true })
  mkdirSync(ALT_VAULT, { recursive: true })
  writeFileSync(join(ALT_VAULT, 'Alpha.md'),
    '---\ntags:\n  - alt\nsummary: "Alt vault Alpha"\n---\nDifferent content here',
  )

  // 3. Hot-swap to the alt vault
  const original = cfg.system.get().vaultPath
  cfg.system.set({ vaultPath: ALT_VAULT })
  await server.hotSwap()

  // 4. EDIT without GET → must report "must be read".
  // If seenHashes wasn't cleared, the old hash would mismatch the new entry's hash
  // and we'd get a misleading "modified externally" error.
  const { data } = await post(TOOLS.EDIT, {
    name: 'Alpha',
    attributes: { summary: 'forbidden' },
  })
  assert(data.text.includes('must be read'), `seenHashes cleared on swap (got: ${ data.text })`)
  assert(!data.text.includes('modified externally'), 'no spurious "modified externally" after swap')

  // 5. Restore original vault for any tests added after this one
  cfg.system.set({ vaultPath: original })
  await server.hotSwap()
}
