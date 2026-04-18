import { cfg } from '../config.js'
import { deepClone, deepFreeze } from '../lib/utils.js'

export default async function ({ assert, sleep }) {
  // --- deepFreeze ---
  const frozen = deepFreeze({ a: { b: 1 }, arr: [1, 2] })
  assert(Object.isFrozen(frozen), 'deepFreeze: top frozen')
  assert(Object.isFrozen(frozen.a), 'deepFreeze: nested frozen')
  assert(Object.isFrozen(frozen.arr), 'deepFreeze: array frozen')

  let threw = false
  try { frozen.a.b = 2 } catch { threw = true }
  assert(threw, 'deepFreeze: nested mutation throws (strict mode)')

  // --- deepClone ---
  const orig = { a: { b: [1, 2] }, c: 'x' }
  const copy = deepClone(orig)
  copy.a.b.push(3)
  copy.a.b[0] = 99
  assert(orig.a.b.length === 2, 'deepClone: orig array length unchanged')
  assert(orig.a.b[0] === 1, 'deepClone: orig array item unchanged')
  assert(copy.a !== orig.a, 'deepClone: nested object refs are independent')

  // --- Fix 2: VAULT_DEFAULTS isolation ---
  // Mutating runtime state must not affect disk-stored defaults
  const organizeSnapshot = deepClone(cfg.state.vault.organize)
  cfg.state.vault.organize.projects.LEAK_TEST = { folder: 'leak', rules: [] }

  // Re-read from disk to confirm persistence layer is clean
  const fromDisk = cfg.vault.get()
  assert(!fromDisk.organize?.projects?.LEAK_TEST, 'Fix 2: mutation of runtime state does not persist')

  // Revert runtime mutation
  cfg.state.vault.organize = organizeSnapshot

  // --- Fix 6: unknown-key guard on systemSet ---
  const before = cfg.system.get()
  cfg.system.set({ randomKey: 123, startMinimized: before.startMinimized })
  const after = cfg.system.get()
  assert(!('randomKey' in after), 'Fix 6: unknown system key dropped')
  assert(after.startMinimized === before.startMinimized, 'Fix 6: valid system key preserved')

  // --- Fix 6: unknown-key guard on vaultSet ---
  const vBefore = cfg.vault.get()
  cfg.vault.set({ api: { port: 99999 }, guidelineName: vBefore.guidelineName })
  const vAfter = cfg.vault.get()
  assert(!('api' in vAfter), 'Fix 6: unknown vault key dropped')
  assert(vAfter.guidelineName === vBefore.guidelineName, 'Fix 6: valid vault key preserved')

  // --- Fix 3: no double vaultChanged emit after vault set (watcher should not re-fire) ---
  let emits = 0
  const bind = cfg.vault.changed.on(() => emits++)
  cfg.vault.set({ guidelineName: vBefore.guidelineName })  // explicit emit → #1
  await sleep(700)  // past 500ms watcher debounce; if hash-check was missing, emit #2 would arrive
  assert(emits === 1, `Fix 3: exactly one vaultChanged emit after set (got ${ emits })`)
  bind.off()

  // --- Fix 4: vaultState resets to defaults when vaultPath becomes empty ---
  // (run last — this clears runtime vault state; safe because 20-config is the final test file)
  const savedVaultPath = cfg.system.get().vaultPath
  cfg.state.vault.ignore.folders.push('LEAK_FOLDER')  // simulate stale runtime mutation
  cfg.system.set({ vaultPath: '' })
  assert(!cfg.state.vault.ignore.folders.includes('LEAK_FOLDER'), 'Fix 4: stale vault state cleared on empty vaultPath')
  assert(cfg.state.vault.vectorCacheDir === null, 'Fix 4: vectorCacheDir nulled on empty vaultPath')
  // Restore for graceful teardown
  cfg.system.set({ vaultPath: savedVaultPath })
}
