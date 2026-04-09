import matter        from 'gray-matter'
import { store }     from '../modules/store.js'
import { cfg }       from '../config.js'
import { orderKeys } from '../lib/utils.js'

const HIDDEN_FIELDS = new Set([ 'source_file', 'content_hash', 'content' ])
const LOG_SKIP = new Set([ 'name', 'source_file', 'content_hash', 'content', 'created', 'modified', 'summary', 'aliases' ])

/**
 * Tracks content_hash at the time AI last read an entry.
 * Write tools check this to reject stale mutations.
 */
const seenHashes = new Map()

/** Mark entry as seen by AI (call from read tools: get, what_is) */
export function markSeen (entry) {
  if (entry?.content_hash) seenHashes.set(entry.name, entry.content_hash)
}

/** Check if entry changed since AI last read it. Returns error message or null. */
export function checkStale (entry) {
  const seen = seenHashes.get(entry.name)
  if (!seen) return `Entry "${ entry.name }" must be read with "get" before modifying.`
  if (seen !== entry.content_hash) return `Entry "${ entry.name }" was modified externally since you last read it. Use "get" to see current version before editing.`
  return null
}

/** Short props string for bus log: project, tags, custom fields */
export function entryProps (entry) {
  const parts = []
  if (entry.project) parts.push(entry.project)
  if (entry.tags?.length) parts.push(entry.tags[0])
  for (const [k, v] of Object.entries(entry)) {
    if (LOG_SKIP.has(k) || k === 'project' || k === 'tags') continue
    if (v == null || (Array.isArray(v) && !v.length)) continue
    parts.push(`${ k }=${ v }`)
  }
  return parts.join(', ') || null
}

/**
 * Format entry as YAML frontmatter + markdown content.
 * Same format as stored on disk in Obsidian.
 * @param {object} entry
 * @returns {string}
 */
export function formatEntry (entry) {
  const frontmatter = {}
  for (const [ key, value ] of Object.entries(entry)) {
    if (HIDDEN_FIELDS.has(key)) continue
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    frontmatter[key] = value
  }
  const ordered = orderKeys(frontmatter, cfg.state.frontmatterHead, cfg.state.frontmatterTail)
  return matter.stringify(entry.content || '', ordered).trim()
}

/**
 * Find entry by name (case-insensitive).
 * @param {string} name
 * @returns {object|null}
 */
export function findEntry (name) {
  return store.entries.get(name)
}

/**
 * Format "entry not found" message with semantic suggestions.
 * @param {string} name - Entry name that wasn't found
 * @returns {Promise<string>}
 */
export async function entryNotFoundMessage (name) {
  let response = `Entry "${ name }" not found.`

  const results = await store.entries.searchByVector(name, 5)
  const suggestions = results.filter(r => r.score > 0.4)

  if (suggestions.length > 0) {
    response += '\n\nSimilar entries:'
    for (const r of suggestions) {
      const tag = r.entity.tags?.[0] || ''
      response += `\n- [[${ r.entity.name }]] (${ tag } - ${ (r.score * 100).toFixed(0) }%)`
    }
    response += '\n\nUse exact name from suggestions.'
  }

  return response
}
