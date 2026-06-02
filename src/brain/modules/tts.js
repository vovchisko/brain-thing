import path                                               from 'path'
import fs                                                 from 'fs'
import { cfg }                                            from '../config.js'
import { store }                                          from './store.js'
import { chunkHash, chunkText, cleanForTts, jobChecksum } from '../lib/chunker.js'
import { createBus }                                      from '../lib/bus.js'

const bus = createBus('tts')

let _config = null
let TTS_URL = null
let CHUNKS_FILE = null

let chunkState = {}
let lastTtsOn = false
let lastRulesHash = ''
let lastVaultPath = ''

function loadChunkState () {
  try { chunkState = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf8')) } catch { chunkState = {} }
}

function saveChunkState () {
  if (!CHUNKS_FILE) return
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunkState, null, 2))
}

async function isRunning () {
  try {
    const res = await fetch(`${ TTS_URL }/status`)
    return res.ok
  } catch { return false }
}

function ruleFor (entry) {
  const rules = _config?.vault?.narrate?.rules || []
  for (const r of rules) {
    const hasTag = !!r.tag
    const hasAttr = !!(r.attribute && r.value != null && r.value !== '')
    if (!hasTag && !hasAttr) continue

    const tagOk = hasTag ? (entry.tags?.some(t => t.startsWith(r.tag)) ?? false) : true
    if (!tagOk) continue

    const attrOk = hasAttr ? entry[r.attribute] === r.value : true
    if (!attrOk) continue

    return r
  }
  return null
}

function ruleSignature (rule) {
  return [
    rule.voice || 'ava',
    rule.language || 'en',
    rule.collection || '',
    rule.album || '',
    rule.artist || '',
    String(rule.priority ?? 0),
    rule.force ? '1' : '0',
  ].join('|')
}

function chunkEntry (entry, rule) {
  const voice = rule.voice || 'ava'
  const language = rule.language || 'en'
  const { chunks, warnings } = chunkText(entry.content)
  const hashes = chunks.map(c => chunkHash(c, voice, language))
  const checksum = jobChecksum(hashes)
  const signature = `${ checksum }|${ ruleSignature(rule) }`

  const state = {
    name: entry.name,
    voice,
    language,
    collection: rule.collection || null,
    album: rule.album || null,
    artist: rule.artist || null,
    priority: rule.priority ?? 0,
    checksum,
    signature,
    total: chunks.length,
    warnings,
    chunks: chunks.map((text, i) => ({ index: i, text, hash: hashes[i], length: text.length })),
  }
  return state
}

async function send (entry, rule, state) {
  const body = {
    name: entry.name,
    chunks: state.chunks.map(c => cleanForTts(c.text)),
  }
  if (state.collection) body.collection = state.collection
  if (state.voice && state.voice !== 'ava') body.voice = state.voice
  if (state.language && state.language !== 'en') body.language = state.language
  if (state.album) body.album = state.album
  if (state.artist) body.artist = state.artist
  if (state.priority) body.priority = state.priority

  const res = await fetch(`${ TTS_URL }/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function deleteJob (name) {
  try {
    await fetch(`${ TTS_URL }/delete/${ encodeURIComponent(name) }`, { method: 'DELETE' })
  } catch { /* ignore */ }
}

async function applyEntry (entry) {
  if (!CHUNKS_FILE) return
  if (!entry.content?.trim()) return

  const rule = ruleFor(entry)
  const prev = chunkState[entry.name]

  if (!rule) {
    if (prev) {
      delete chunkState[entry.name]
      saveChunkState()
      if (await isRunning()) await deleteJob(entry.name)
      bus.info('cleanup', `${ entry.name } no longer matches any rule`)
    }
    return
  }

  const state = chunkEntry(entry, rule)
  if (prev?.signature === state.signature) return

  if (state.warnings.length && !rule.force) {
    bus.warn('chunk', `${ entry.name } has ${ state.warnings.length } chunking warning(s) — skipping (set force in rule to override)`)
    return
  }

  chunkState[entry.name] = state
  saveChunkState()

  if (state.warnings.length) {
    for (const w of state.warnings) bus.warn('chunk', `${ entry.name }: ${ w }`)
  }

  if (!await isRunning()) {
    bus.warn('sync', `${ entry.name } changed but TTS server is not running`)
    return
  }

  try {
    const res = await send(entry, rule, state)
    if (res.ok) bus.info('sync', `${ entry.name } → ${ res.data.status || 'queued' } (${ state.total } chunks)`)
    else bus.error('sync', `${ entry.name } TTS error: ${ JSON.stringify(res.data.detail || res.data) }`)
  } catch (err) {
    bus.error('sync', `${ entry.name } failed: ${ err.message }`)
  }
}

async function applyAll () {
  if (!CHUNKS_FILE) return
  for (const entry of store.entries) {
    await applyEntry(entry)
  }
  await reconcileServerJobs()
}

async function listJobs () {
  try {
    const res = await fetch(`${ TTS_URL }/jobs`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function reconcileServerJobs () {
  if (!CHUNKS_FILE) return
  if (!await isRunning()) return

  const jobs = await listJobs()
  if (!jobs) return

  const desired = new Set()
  for (const entry of store.entries) {
    if (!entry.content?.trim()) continue
    if (ruleFor(entry)) desired.add(entry.name)
  }

  const orphans = jobs.filter(j => !desired.has(j.name))
  if (!orphans.length) return

  for (const job of orphans) {
    await deleteJob(job.name)
    delete chunkState[job.name]
  }
  saveChunkState()
  bus.info('cleanup', `Removed ${ orphans.length } orphan job(s): ${ orphans.map(j => j.name).join(', ') }`)
}

async function rerunJobs () {
  if (!CHUNKS_FILE) return { error: 'TTS feature is off' }
  if (!await isRunning()) return { error: 'TTS server unreachable' }

  let triggered = 0
  let skipped = 0
  const failed = []

  for (const entry of store.entries) {
    if (!entry.content?.trim()) continue
    const rule = ruleFor(entry)
    if (!rule) continue

    const state = chunkEntry(entry, rule)
    if (state.warnings.length && !rule.force) {
      skipped++
      continue
    }

    chunkState[entry.name] = state
    try {
      const res = await send(entry, rule, state)
      if (res.ok) triggered++
      else failed.push(entry.name)
    } catch (err) {
      failed.push(entry.name)
      bus.error('rerun', `${ entry.name }: ${ err.message }`)
    }
  }
  saveChunkState()
  await reconcileServerJobs()

  bus.info('rerun', `Re-triggered ${ triggered } job(s)${ skipped ? `, skipped ${ skipped }` : '' }${ failed.length ? `, ${ failed.length } failed` : '' }`)
  return { triggered, skipped, failed }
}

async function flushChunks () {
  if (!CHUNKS_FILE) return { error: 'TTS feature is off' }
  if (!await isRunning()) return { error: 'TTS server unreachable' }
  try {
    const res = await fetch(`${ TTS_URL }/flush`, { method: 'POST' })
    if (!res.ok) return { error: `TTS error ${ res.status }` }
    const data = await res.json().catch(() => ({}))
    const deleted = data.deleted_chunks || 0
    bus.info('flush', `${ deleted } orphan chunk(s) flushed`)
    return { deletedChunks: deleted }
  } catch (err) {
    return { error: err.message }
  }
}

async function bootstrap () {
  TTS_URL = `http://${ _config.const.tts.host }:${ _config.const.tts.port }`
  CHUNKS_FILE = path.join(_config.system.vaultPath, '.brain-thing', 'tts-chunks.json')
  loadChunkState()

  bus.info('init', 'Waiting for TTS...')
  while (!await isRunning()) {
    if (!_config.vault.features?.tts) { bus.info('init', 'TTS feature turned off — bootstrap aborted'); return }
    await new Promise(r => setTimeout(r, 15_000))
  }
  bus.info('init', 'TTS online — re-triggering all jobs')
  await rerunJobs()
}

function shutdown () {
  TTS_URL = null
  CHUNKS_FILE = null
  chunkState = {}
}

async function handleVaultChange () {
  // Vault swap in progress — server.hotSwap() will call reload() after the store rebuilds.
  // Reacting here would run applyAll against stale entries from the old vault.
  if (_config.system.vaultPath !== lastVaultPath) return

  const ttsOn = !!_config.vault.features?.tts
  const rulesHash = JSON.stringify(_config.vault.narrate?.rules || [])

  if (ttsOn && !lastTtsOn) {
    lastTtsOn = true
    lastRulesHash = rulesHash
    await bootstrap()
    return
  }
  if (!ttsOn && lastTtsOn) {
    lastTtsOn = false
    shutdown()
    return
  }
  if (ttsOn && rulesHash !== lastRulesHash) {
    lastRulesHash = rulesHash
    await applyAll()
  }
}

/** Re-sync TTS state for a freshly hot-swapped vault. Called from server.hotSwap() after store rebuilds. */
async function reload () {
  if (!_config) return

  // Drop in-memory chunkState — keys belong to the previous vault
  chunkState = {}
  lastVaultPath = _config.system.vaultPath
  lastRulesHash = JSON.stringify(_config.vault.narrate?.rules || [])

  const ttsOn = !!_config.vault.features?.tts

  if (!ttsOn) {
    if (lastTtsOn) shutdown()
    lastTtsOn = false
    return
  }

  lastTtsOn = true
  bootstrap().catch(err => bus.error('reload', err.message))
}

function init (config) {
  _config = config
  lastVaultPath = config.system.vaultPath
  cfg.vault.changed.on(handleVaultChange)
  if (config.vault.features?.tts) {
    lastTtsOn = true
    lastRulesHash = JSON.stringify(config.vault.narrate?.rules || [])
    bootstrap().catch(err => bus.error('init', err.message))
  }
}

async function onFilesChanged (filePaths) {
  if (!CHUNKS_FILE) return
  for (const fp of filePaths) {
    const name = path.basename(fp, '.md')
    const entry = store.entries.get(name)
    if (entry) {
      await applyEntry(entry)
    } else if (chunkState[name]) {
      delete chunkState[name]
      saveChunkState()
      if (await isRunning()) await deleteJob(name)
      bus.info('cleanup', `${ name } removed from vault — job deleted`)
    }
  }
}

export const tts = { init, reload, onFilesChanged, isRunning, flushChunks, rerunJobs }

export const __test = {
  ruleFor,
  ruleSignature,
  setConfig: (c) => { _config = c },
  getChunksFile: () => CHUNKS_FILE,
}
