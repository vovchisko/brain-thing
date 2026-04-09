import path                                               from 'path'
import fs                                                 from 'fs'
import { store }                                          from './store.js'
import { chunkHash, chunkText, cleanForTts, jobChecksum } from '../lib/chunker.js'
import { createBus } from '../lib/bus.js'

const bus = createBus('tts')

let _config = null
let TTS_URL = null
let CHUNKS_FILE = null

/** In-memory chunk state per entry name */
let chunkState = {}

function loadChunkState () {
  try { chunkState = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf8')) } catch { chunkState = {} }
}

function saveChunkState () {
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunkState, null, 2))
}

async function isRunning () {
  try {
    const res = await fetch(`${ TTS_URL }/status`)
    return res.ok
  } catch { return false }
}

/**
 * Parse narrate field: "collection --voice:alba --language:uk --force"
 */
function parseNarrate (value) {
  const voiceMatch = value.match(/--voice:(\S+)/)
  const langMatch = value.match(/--language:(\S+)/)
  const force = /--force/.test(value)
  const voice = voiceMatch ? voiceMatch[1] : 'ava'
  const language = langMatch ? langMatch[1] : 'en'
  const collection = value.replace(/--voice:\S+/g, '').replace(/--language:\S+/g, '').replace(/--force/g, '').trim() || null
  return { collection, voice, language, force }
}

async function send (name, chunks, { collection, voice, language } = {}) {
  const body = { name, chunks }
  if (collection) body.collection = collection
  if (voice && voice !== 'ava') body.voice = voice
  if (language && language !== 'en') body.language = language
  const res = await fetch(`${ TTS_URL }/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

function chunkEntry (entry) {
  const { collection, voice, language } = parseNarrate(entry.narrate)
  const { chunks, warnings } = chunkText(entry.content)
  const hashes = chunks.map(c => chunkHash(c, voice, language))
  const checksum = jobChecksum(hashes)

  const state = {
    name: entry.name,
    collection,
    voice,
    language,
    checksum,
    total: chunks.length,
    warnings,
    chunks: chunks.map((text, i) => ({ index: i, text, hash: hashes[i], length: text.length })),
  }

  chunkState[entry.name] = state
  return state
}

async function narrate (entry) {
  const opts = parseNarrate(entry.narrate)
  const state = chunkEntry(entry)

  const res = await send(entry.name, state.chunks.map(c => cleanForTts(c.text)), opts)

  if (res.ok) {
    bus.info('sync', `${ entry.name } → ${ res.data.status } (${ state.total } chunks)`)
  } else {
    bus.error('sync', `${ entry.name } TTS error: ${ JSON.stringify(res.data.detail || res.data) }`)
  }
}

async function init (config) {
  _config = config
  TTS_URL = `http://${ config.tts.host }:${ config.tts.port }`
  CHUNKS_FILE = path.join(config.dataDir, 'tts-chunks.json')

  loadChunkState()

  const entries = [ ...store.entries ].filter(e => e.narrate && typeof e.narrate === 'string' && e.content?.trim())
  if (entries.length === 0) return

  for (const entry of entries) {
    const state = chunkEntry(entry)
    if (state.warnings.length) {
      bus.info('chunk', `${ entry.name } ${ state.total } chunks, ${ state.warnings.length } warning(s)`)
      for (const w of state.warnings) bus.warn('chunk', w)
    }
  }
  saveChunkState()
  bus.info('chunk', `Chunked ${ entries.length } entries`)

  bus.info('init', 'Waiting for TTS...')
  while (!await isRunning()) {
    await new Promise(r => setTimeout(r, 15_000))
  }
  bus.info('init', 'TTS online - syncing')

  for (const entry of entries) {
    try {
      await narrate(entry)
    } catch (err) {
      bus.error('sync', `${ entry.name } failed: ${ err.message }`)
    }
  }
  bus.info('sync', 'Sync done')
}

async function onFilesChanged (filePaths) {
  const toNarrate = []

  for (const fp of filePaths) {
    const name = path.basename(fp, '.md')
    const entry = store.entries.get(name)
    if (!entry?.narrate || typeof entry.narrate !== 'string' || !entry.content?.trim()) continue

    const prev = chunkState[name]
    const state = chunkEntry(entry)

    if (prev?.checksum === state.checksum) continue

    bus.info('chunk', `${ name } rechunked: ${ state.total } chunks`)
    if (state.warnings.length) {
      for (const w of state.warnings) bus.warn('chunk', w)
    }

    toNarrate.push(entry)
  }

  if (toNarrate.length === 0) return
  saveChunkState()

  if (!await isRunning()) {
    bus.warn('sync', `${ toNarrate.length } file(s) changed but TTS is not running`)
    return
  }

  for (const entry of toNarrate) {
    try {
      await narrate(entry)
    } catch (err) {
      bus.error('sync', `${ entry.name } failed: ${ err.message }`)
    }
  }
}

export const tts = { isRunning, init, onFilesChanged }
