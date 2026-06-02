import Signal         from 'a-signal'
import { Collection } from '../lib/collection.js'
import { Entry }      from '../models/Entry.js'
import { embeddings } from './embeddings.js'

class VectorCollection extends Collection {
  async ensureVector (entity) {
    if (entity.vectors.has('default')) return
    const text = entity.summary
        ? `${ entity.name }\n\n${ entity.summary }`
        : `${ entity.name }\n\n${ entity.content }`
    const hash = embeddings.hashContent(text)
    const vector = await embeddings.getVector(text, entity.name)
    entity.setVector('default', text, hash, vector)
  }

  async ensureVectors () {
    for (const entity of this) {
      await this.ensureVector(entity)
    }
  }

  async searchByVector (query, limit = 5) {
    const queryVector = await embeddings.getVector(query)
    const results = []

    for (const entity of this) {
      await this.ensureVector(entity)

      let bestScore = 0
      for (const vecData of entity.vectors.values()) {
        const score = embeddings.cosineSimilarity(queryVector, vecData.vector)
        if (score > bestScore) bestScore = score
      }

      results.push({ entity, score: bestScore })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }
}

let _config = null
let _entries = null
let SKIP_ATTRIBUTES = null

const ready = new Signal({ late: true, memorable: true })

function init (config) {
  _config = config
  _entries = new VectorCollection(Entry, {
    vectorDimensions: config.const.embeddings.dimensions,
  })
  SKIP_ATTRIBUTES = new Set([
    'name', 'source_file', 'content_hash',
    ...config.const.skipLinkScan || [],
  ])
}

function collectSearchableText (entry) {
  let text = ''
  for (const [ key, value ] of Object.entries(entry)) {
    if (SKIP_ATTRIBUTES.has(key)) continue
    if (typeof value === 'string') text += '\n' + value
  }
  return text
}

function findBacklinks (targetName) {
  const backlinks = []
  const pattern = /\[\[([^\]]+)\]\]/g

  function extractLinkTarget (wikilink) {
    const withoutDisplay = wikilink.split('|')[0]
    const withoutSection = withoutDisplay.split('#')[0]
    return withoutSection.trim()
  }

  function matchesTarget (linkText, targetEntry) {
    const actualLink = extractLinkTarget(linkText)
    const normalizedLink = actualLink.toLowerCase().trim()

    if (normalizedLink === targetEntry.name.toLowerCase().trim()) return true

    if (targetEntry.aliases) {
      for (const alias of targetEntry.aliases) {
        if (normalizedLink === alias.toLowerCase().trim()) return true
      }
    }

    return false
  }

  const targetEntry = _entries.get(targetName)
  if (!targetEntry) return backlinks

  const seen = new Set()
  for (const entry of _entries) {
    if (seen.has(entry.name)) continue
    const matches = [ ...collectSearchableText(entry).matchAll(pattern) ]
    for (const match of matches) {
      if (matchesTarget(match[1], targetEntry)) {
        backlinks.push(entry)
        seen.add(entry.name)
        break
      }
    }
  }

  return backlinks
}

export const store = {
  ready,
  init,
  findBacklinks,
  get entries () { return _entries },
}
