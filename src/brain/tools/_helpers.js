import matter                     from 'gray-matter'
import { store }                   from '../modules/store.js'
import { cfg }                     from '../config.js'
import { orderKeys, countWords, extractWikilinks, isEmptyEntry } from '../lib/utils.js'

// Never surface in frontmatter: storage internals (source_file/content_hash/content),
// the identity (`name` — it lifts to the `=== [[name]] ===` line, not an attribute),
// and computed fields (`wordCount` — not a real frontmatter key).
const HIDDEN_ATTRIBUTES = new Set([ 'source_file', 'content_hash', 'content', 'name', 'wordCount' ])
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

/** Drop all seen-hashes. Called from server.hotSwap() — old vault's hashes don't apply to the new vault. */
export function clearSeenHashes () {
  seenHashes.clear()
}

/** Flatten whitespace + truncate for single-line preview. Returns '' if empty. */
export function previewContent (text, maxLen = 200) {
  if (!text) return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  return flat.length > maxLen ? flat.slice(0, maxLen) + '…' : flat
}

export function wordsOf (entry) {
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

/**
 * Check typed attributes for parse failures. Returns array of warning strings.
 * String attributes never warn (they accept anything). Only configured typed attributes.
 */
export function typeWarnings (attrs) {
  const attrMap = cfg.state.vault.attributes || {}
  const warnings = []
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue
    const type = attrMap[key]
    if (!type || type.type === 'string') continue
    const parsed = type.parse(value)
    const failed = (type.type === 'date' && !(parsed instanceof Date))
                || (type.type === 'number' && typeof parsed !== 'number')
    if (failed) {
      warnings.push(`attribute "${ key }" (${ type.type }): value ${ JSON.stringify(value) } did not parse; stored as-is`)
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
 * Build the `---`-fenced YAML frontmatter block for a doc (configured key order,
 * summary last). Hidden/null/empty-array fields are dropped. Returns '' when no
 * fields survive — a doc with no attributes renders header + body, no fence.
 */
function buildFrontmatter (entry) {
  const data = {}
  for (const [ key, value ] of Object.entries(entry)) {
    if (HIDDEN_ATTRIBUTES.has(key)) continue
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    data[key] = value
  }
  const ordered = orderKeys(data, cfg.state.const.frontmatterHead, cfg.state.const.frontmatterTail)
  if (!Object.keys(ordered).length) return ''
  return matter.stringify('', ordered).trim()
}

/**
 * Collect a doc's link context for the `=== links ===` block.
 * @returns {{ backlinks: object[], missing: string[], empty: object[] }}
 */
export function gatherLinks (entry) {
  const backlinks = store.findBacklinks(entry.name) || []
  const missing = []
  const empty = []
  for (const linkName of new Set(extractWikilinks(entry.content))) {
    if (linkName === entry.name) continue
    const target = store.entries.get(linkName)
    if (!target) missing.push(linkName)
    else if (isEmptyEntry(target)) empty.push(target)
  }
  return { backlinks, missing, empty }
}

/**
 * Render the trailing `=== links ===` block (aligned labels). Returns '' when no
 * links — the doc then has no links block at all. Backlinks/missing/empty are
 * separated from the body by their own marker so the AI never edits them as content.
 */
export function renderLinks ({ backlinks = [], missing = [], empty = [] } = {}) {
  const rows = []
  if (backlinks.length) rows.push([ 'backlinks', backlinks.map(e => `[[${ e.name }]]`) ])
  if (missing.length)   rows.push([ 'missing',   missing.map(n => `[[${ n }]]`) ])
  if (empty.length)     rows.push([ 'empty',     empty.map(e => `[[${ e.name }]]`) ])
  if (!rows.length) return ''
  const pad = Math.max(...rows.map(([ label ]) => label.length)) + 2   // colon + ≥1 space
  const lines = rows.map(([ label, items ]) => `${ (label + ':').padEnd(pad) }${ items.join(', ') }`)
  return `=== links ===\n${ lines.join('\n') }`
}

/**
 * Single per-document renderer, shared by `get` and `long_read` (long_read = get
 * repeated). Identity lives on the `=== [[name]] ===` line — never a `name:` key
 * or a `# Name` heading (both read as attribute/body to the model).
 *   full     → header + fenced frontmatter + body + (links if provided)
 *   focus    → header + body only
 *   estimate → header + fenced frontmatter + word count (no body)
 * @param {object} entry
 * @param {'full'|'focus'|'estimate'} mode
 * @param {{ links?: object }} [opts]
 */
export function renderDoc (entry, mode = 'full', { links } = {}) {
  const header = `=== [[${ entry.name }]] ===`

  if (mode === 'focus') {
    return `${ header }\n\n${ entry.content || '' }`.trimEnd()
  }

  const fm = buildFrontmatter(entry)

  if (mode === 'estimate') {
    return [ header, fm, `${ wordsOf(entry) } words` ].filter(Boolean).join('\n')
  }

  // full
  const parts = [ header ]
  if (fm) parts.push(fm)
  parts.push('', entry.content || '')          // blank line, then body
  let out = parts.join('\n').trimEnd()
  const linkBlock = links ? renderLinks(links) : ''
  if (linkBlock) out += `\n\n${ linkBlock }`
  return out
}

/** Find entry by name (case-insensitive). */
export function findEntry (name) {
  return store.entries.get(name)
}

/** Format "entry not found" message with semantic suggestions. */
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
