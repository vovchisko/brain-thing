import Signal         from 'a-signal'
import { Collection } from '../lib/collection.js'
import { Entry }      from '../models/Entry.js'
import { embeddings } from './embeddings.js'
import { config }     from '../config.js'

class VectorCollection extends Collection {
  /**
   * Ensure entry has default vector
   * @param {Entry} entity
   */
  async ensureVector (entity) {
    if (entity.vectors.has('default')) return
    const skip = config.embeddings.skipTags
    if (skip?.length && entity.tags?.some(t => skip.includes(t))) return

    const text = entity.summary
        ? `${ entity.name }\n\n${ entity.summary }`
        : `${ entity.name }\n\n${ entity.content }`
    const hash = embeddings.hashContent(text)
    const vector = await embeddings.getVector(text, entity.name)
    entity.setVector('default', text, hash, vector)
  }

  /** Ensure all entries have vectors */
  async ensureVectors () {
    for (const entity of this) {
      await this.ensureVector(entity)
    }
  }

  /**
   * Search by vector similarity
   * @param {string} query
   * @param {number} [limit=5]
   * @returns {Promise<Array<{entity: Entry, score: number}>>}
   */
  async searchByVector (query, limit = 5) {
    const queryVector = await embeddings.getVector(query)
    const results = []

    for (const entity of this) {
      await this.ensureVector(entity)

      // Find best score across all vectors for this entry
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

const entries = new VectorCollection(Entry, {
  vectorDimensions: config.embeddings.dimensions,
})

const SKIP_FIELDS = new Set([
  'name', 'source_file', 'content_hash',
  ...config.skipLinkScan || [],
])

/** Collect all string field values from entry for wikilink scanning */
function collectSearchableText (entry) {
  let text = ''
  for (const [ key, value ] of Object.entries(entry)) {
    if (SKIP_FIELDS.has(key)) continue
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

  const targetEntry = entries.get(targetName)
  if (!targetEntry) return backlinks

  const seen = new Set()
  for (const entry of entries) {
    if (seen.has(entry.name)) continue
    const matches = [ ...collectSearchableText(entry).matchAll(pattern) ]
    for (const match of matches) {
      if (matchesTarget(match[1], targetEntry)) {
        backlinks.push({ name: entry.name })
        seen.add(entry.name)
        break
      }
    }
  }

  return backlinks
}

const ready = new Signal({ late: true })

export const store = {
  ready,
  findBacklinks,
  entries,
}
