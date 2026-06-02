import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cfg } from '../config.js'
import { server } from '../server.js'
import { __test as ttsTest } from '../modules/tts.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ALT_VAULT = join(HERE, '..', '_test-env', 'tts-alt-vault')

export default async function ({ assert, sleep }) {
  const originalVault = cfg.system.get().vaultPath

  // Build alt vault with TTS feature pre-enabled (so reload() takes the bootstrap branch on swap)
  rmSync(ALT_VAULT, { recursive: true, force: true })
  mkdirSync(join(ALT_VAULT, '.brain-thing'), { recursive: true })
  writeFileSync(join(ALT_VAULT, 'Bravo.md'),
    '---\ntags:\n  - alt\n---\nAlt vault content',
  )
  writeFileSync(join(ALT_VAULT, '.brain-thing', 'settings.json'),
    JSON.stringify({ features: { tts: true } }),
  )

  // Enable TTS in the current vault — handleVaultChange runs bootstrap (background, no TTS server present)
  cfg.vault.set({ features: { tts: true } })
  await sleep(150)

  const beforeSwap = ttsTest.getChunksFile()
  assert(beforeSwap, 'CHUNKS_FILE set after enabling TTS')
  assert(beforeSwap.startsWith(originalVault), `CHUNKS_FILE inside current vault (got: ${ beforeSwap })`)
  assert(beforeSwap.endsWith(join('.brain-thing', 'tts-chunks.json')), 'CHUNKS_FILE in .brain-thing dir')

  // Hot-swap to alt vault (TTS also on there) — reload() should retarget paths
  cfg.system.set({ vaultPath: ALT_VAULT })
  await server.hotSwap()
  await sleep(150)

  const afterSwap = ttsTest.getChunksFile()
  assert(afterSwap, 'CHUNKS_FILE set after swap')
  assert(afterSwap.startsWith(ALT_VAULT), `CHUNKS_FILE retargeted to alt vault (got: ${ afterSwap })`)
  assert(afterSwap !== beforeSwap, 'CHUNKS_FILE actually moved')

  // Cleanup — disable TTS, swap back, ensure off in original
  cfg.vault.set({ features: { tts: false } })
  await sleep(50)
  cfg.system.set({ vaultPath: originalVault })
  await server.hotSwap()
  cfg.vault.set({ features: { tts: false } })
  await sleep(50)
}
