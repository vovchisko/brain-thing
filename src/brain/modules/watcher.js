import { watch }        from 'node:fs'
import path             from 'node:path'
import { createBus }    from '../lib/bus.js'
import { shouldIgnore } from '../lib/utils.js'

const bus = createBus('watcher', { system: true })

let _config = null
let debounceTimer = null
let pendingChanges = new Set()
let onChangeCallback = null
let activeWatcher = null

function handleChange (eventType, filename, dir) {
  if (!filename || !filename.endsWith('.md')) return
  const fullPath = path.join(dir, filename)
  if (shouldIgnore(fullPath, _config.vault.ignore)) return

  pendingChanges.add(fullPath)
  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    const changes = Array.from(pendingChanges)
    pendingChanges.clear()
    bus.info('change', `${ changes.length } file(s)`)
    if (onChangeCallback) await onChangeCallback(changes)
  }, 500)
}

function stop () {
  if (activeWatcher) {
    activeWatcher.close()
    activeWatcher = null
    bus.info('stop', 'Stopped')
  }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  pendingChanges.clear()
}

function start (config, callback) {
  stop()
  _config = config
  onChangeCallback = callback
  try {
    activeWatcher = watch(_config.system.vaultPath, { recursive: true }, (eventType, filename) => {
      handleChange(eventType, filename, _config.system.vaultPath)
    })
    bus.info('start', `Watching ${ _config.system.vaultPath }`)
  } catch (err) {
    bus.error('start', `Failed to watch ${ _config.system.vaultPath }: ${ err.message }`)
  }
}

export const watcher = { start, stop }
