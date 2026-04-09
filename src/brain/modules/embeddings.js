import { pipeline } from '@xenova/transformers'
import crypto       from 'node:crypto'
import fs           from 'node:fs/promises'
import path         from 'node:path'
import { createBus } from '../lib/bus.js'

const bus = createBus('embed', { system: true })

let embedder = null
let _config = null
const accessedHashes = new Set()

function cacheDir () {
  return _config?.vectorCacheDir || '.vector-cache'
}

async function ensureCacheDir () {
  try { await fs.mkdir(cacheDir(), { recursive: true }) } catch { /* ignore */ }
}

function hashContent (text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function getCachePath (hash) {
  return path.join(cacheDir(), `${ hash }.bin`)
}

async function loadVectorFromCache (hash) {
  try {
    const cachePath = getCachePath(hash)
    const buffer = await fs.readFile(cachePath)
    const vector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
    accessedHashes.add(hash)
    return Array.from(vector)
  } catch (err) {
    return null
  }
}

async function saveVectorToCache (hash, vector) {
  await ensureCacheDir()
  const cachePath = getCachePath(hash)
  const buffer = new Float32Array(vector)
  await fs.writeFile(cachePath, Buffer.from(buffer.buffer))
  accessedHashes.add(hash)
}

let _onProgress = null

async function init (config) {
  _config = config
  const modelCache = config.modelCacheDir || undefined
  bus.info('init', `Loading model: ${ config.embeddings.model }${ modelCache ? ` (cache: ${ modelCache })` : '' }`)
  embedder = await pipeline('feature-extraction', config.embeddings.model, {
    cache_dir: modelCache,
    progress_callback: (data) => {
      if (_onProgress) _onProgress(data)
    },
  })
  bus.info('init', 'Model loaded')
  accessedHashes.clear()
}

const MAX_CHARS = 8000

async function embed (text, label) {
  if (!embedder) throw new Error('Embedder not initialized')

  if (text.length > MAX_CHARS) bus.warn('embed', `Truncating${ label ? ` (${ label })` : '' }: ${ text.length } → ${ MAX_CHARS } chars`)
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text
  const output = await embedder(truncated, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

async function getVector (text, label) {
  if (!embedder) throw new Error('Embedder not initialized')

  const hash = hashContent(text)

  const cached = await loadVectorFromCache(hash)
  if (cached) {
    return cached
  }

  const vector = await embed(text, label)
  await saveVectorToCache(hash, vector)

  return vector
}

async function cleanup () {
  try {
    const dir = cacheDir()
    const files = await fs.readdir(dir)
    let removed = 0

    for (const file of files) {
      if (!file.endsWith('.bin')) continue

      const hash = file.replace('.bin', '')
      if (!accessedHashes.has(hash)) {
        await fs.unlink(path.join(dir, file))
        removed++
      }
    }

    if (removed > 0) {
      bus.info('cleanup', `Removed ${ removed } unused cache files`)
    }
  } catch (err) {
    // Cache dir doesn't exist or other error, ignore
  }
}

function cosineSimilarity (vec1, vec2) {
  if (vec1.length !== vec2.length) throw new Error('Vectors must have same length')

  if (vec1.length === 0) return 0

  let dotProduct = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
  }

  return dotProduct
}

export const embeddings = {
  init,
  embed,
  getVector,
  cleanup,
  cosineSimilarity,
  hashContent,
  set onProgress (fn) { _onProgress = fn },
}
