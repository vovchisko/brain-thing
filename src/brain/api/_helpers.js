import matter                     from 'gray-matter'
import { store }                   from '../modules/store.js'
import { cfg }                     from '../config.js'
import { orderKeys, countWords }   from '../lib/utils.js'

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

/** Flatten whitespace + truncate for single-line preview. Returns '' if empty. */
export function previewContent (text, maxLen = 200) {
  if (!text) return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  return flat.length > maxLen ? flat.slice(0, maxLen) + '…' : flat
}

function wordsOf (entry) {
  return entry.wordCount ?? countWords(entry.content)
}

/**
 * Render ranked/plain entries as a compact multi-line list.
 * @param {Array<{entity: object, score?: number} | object>} items
 * @param {{ showScore?: boolean, hideProject?: boolean }} [opts]
 */
export function formatResultList (items, { showScore = false, hideProject = false } = {}) {
  const blocks = []
  for (const item of items) {
    const entry = item.entity || item
    const score = item.score
    const head = [`[[${ entry.name }]]`]
    if (showScore && score != null) head.push(`(${ Math.round(score * 100) }%)`)
    const lines = [`- ${ head.join(' ') }`]

    const meta = []
    if (!hideProject && entry.project) meta.push(`project: ${ entry.project }`)
    if (entry.tags?.length) meta.push(`tags: ${ entry.tags.join(', ') }`)
    if (meta.length) lines.push(`  ${ meta.join(' · ') }`)

    const preview = entry.summary ? entry.summary : previewContent(entry.content, 200)
    if (preview) lines.push(`  ${ preview }`)

    lines.push(`  words: ${ wordsOf(entry) }`)
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n')
}

/** Compact single-line for backlinks and similar dense lists. */
export function formatEntryInline (entry, { hideProject = false } = {}) {
  const parts = [`[[${ entry.name }]]`]
  const meta = []
  if (!hideProject && entry.project) meta.push(entry.project)
  if (entry.tags?.length) meta.push(entry.tags.join(', '))
  if (meta.length) parts.push(`(${ meta.join(' · ') })`)
  parts.push(`— ${ wordsOf(entry) } words`)
  return parts.join(' ')
}

/**
 * Check typed fields for parse failures. Returns array of warning strings.
 * String fields never warn (they accept anything). Only configured typed fields.
 */
export function typeWarnings (props) {
  const fieldsMap = cfg.state.vault.fields || {}
  const warnings = []
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue
    const type = fieldsMap[key]
    if (!type || type.type === 'string') continue
    const parsed = type.parse(value)
    const failed = (type.type === 'date' && !(parsed instanceof Date))
                || (type.type === 'number' && typeof parsed !== 'number')
    if (failed) {
      warnings.push(`field "${ key }" (${ type.type }): value ${ JSON.stringify(value) } did not parse; stored as-is`)
    }
  }
  return warnings
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
  const ordered = orderKeys(frontmatter, cfg.state.const.frontmatterHead, cfg.state.const.frontmatterTail)
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
