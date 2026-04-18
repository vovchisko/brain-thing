import matter                 from 'gray-matter'
import { cfg }                from '../config.js'
import { ApiError }           from '../lib/api.js'
import { orderKeys }          from '../lib/utils.js'
import { findEntry, markSeen } from './_helpers.js'
import { createBus }          from '../lib/bus.js'

const bus = createBus('long_read')

/** Fields never shown in long_read output (internal, auto-managed, or rendered in the head). */
const HIDDEN = new Set(['name', 'content', 'source_file', 'content_hash', 'wordCount', 'created', 'modified'])

/**
 * Resolve names → {found: Entry[], missing: string[]}. Preserves input order.
 */
function resolve (names) {
  const found = []
  const missing = []
  const seen = new Set()
  for (const raw of names) {
    const name = String(raw).trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const entry = findEntry(name)
    if (entry) found.push(entry)
    else missing.push(name)
  }
  return { found, missing }
}

/**
 * Compute frontmatter shared by all entries (same scalar value OR tag intersection).
 * Returns { common, perEntry } where perEntry is a map name→remaining-fields-object.
 */
function extractCommon (entries) {
  const common = {}
  const perEntry = new Map()
  if (!entries.length) return { common, perEntry }

  // Scalar fields: value must be identical (strict) across all entries
  const candidateKeys = new Set()
  for (const e of entries) {
    for (const k of Object.keys(e)) {
      if (HIDDEN.has(k)) continue
      if (k === 'tags') continue
      candidateKeys.add(k)
    }
  }
  for (const key of candidateKeys) {
    const first = entries[0][key]
    if (first == null) continue
    if (Array.isArray(first)) continue // arrays other than tags: skip hoisting
    if (entries.every(e => e[key] === first)) common[key] = first
  }

  // Tags: intersection across all entries
  if (entries.every(e => Array.isArray(e.tags))) {
    const intersection = entries[0].tags.filter(t => entries.every(e => e.tags.includes(t)))
    if (intersection.length) common.tags = intersection
  }

  // Per-entry remainder
  for (const entry of entries) {
    const rem = {}
    for (const [k, v] of Object.entries(entry)) {
      if (HIDDEN.has(k)) continue
      if (v == null) continue
      if (Array.isArray(v) && v.length === 0) continue

      if (k === 'tags' && common.tags?.length) {
        const extras = v.filter(t => !common.tags.includes(t))
        if (extras.length) rem.tags = extras
      } else if (k in common) {
        // scalar equals common — omit
      } else {
        rem[k] = v
      }
    }
    perEntry.set(entry.name, rem)
  }

  return { common, perEntry }
}

function totalWords (entries) {
  let n = 0
  for (const e of entries) n += e.wordCount || 0
  return n
}

function formatEstimate (entries, missing, includeSummary) {
  const lines = [`# Long read estimate: ${ entries.length } entries, ${ totalWords(entries) } words total`]
  for (const entry of entries) {
    const parts = [`- [[${ entry.name }]]`]
    const meta = []
    if (entry.project) meta.push(`project: ${ entry.project }`)
    if (entry.tags?.length) meta.push(`tags: ${ entry.tags.join(', ') }`)
    if (meta.length) parts.push(`(${ meta.join(' · ') })`)
    parts.push(`— ${ entry.wordCount || 0 } words`)
    lines.push(parts.join(' '))
    if (includeSummary && entry.summary) lines.push(`  ${ entry.summary }`)
  }
  if (missing.length) {
    lines.push('')
    lines.push(`Not found (${ missing.length }): ${ missing.join(', ') }`)
  }
  return lines.join('\n')
}

function formatRead (entries, missing) {
  const { common, perEntry } = extractCommon(entries)
  const lines = [`# Long read: ${ entries.length } entries, ${ totalWords(entries) } words total`]

  const commonKeys = Object.keys(common)
  if (commonKeys.length) {
    lines.push('')
    if (common.project) lines.push(`Project: ${ common.project }`)
    if (common.tags?.length) lines.push(`Shared tags: ${ common.tags.join(', ') }`)
    for (const k of commonKeys) {
      if (k === 'project' || k === 'tags') continue
      lines.push(`${ k }: ${ common[k] }`)
    }
  }

  for (const entry of entries) {
    lines.push('')
    lines.push(`=== [[${ entry.name }]] ===`)
    const rem = perEntry.get(entry.name)
    if (rem && Object.keys(rem).length) {
      const ordered = orderKeys(rem, cfg.state.const.frontmatterHead, cfg.state.const.frontmatterTail)
      const yaml = matter.stringify('', ordered).trim()
      if (yaml) lines.push(yaml)
    }
    lines.push('')
    lines.push(entry.content || '')
  }

  if (missing.length) {
    lines.push('')
    lines.push(`Not found (${ missing.length }): ${ missing.join(', ') }`)
  }
  return lines.join('\n')
}

/**
 * @param {{ operation: 'estimate'|'read', documents: string[], include_summary?: boolean }} body
 */
export async function handleLongRead ({ operation, documents, include_summary = false } = {}) {
  if (operation !== 'estimate' && operation !== 'read') {
    throw new ApiError(400, 'operation must be "estimate" or "read"')
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new ApiError(400, 'documents must be a non-empty array of names')
  }

  const { found, missing } = resolve(documents)
  const ev = bus.op(`${ operation } ${ found.length }/${ documents.length }`)

  if (found.length === 0) {
    ev.warn('all missing')
    return { text: `No entries found for: ${ missing.join(', ') }. Use "what_is" to search by meaning.` }
  }

  if (operation === 'estimate') {
    ev.ok(`${ found.length } entries, ${ totalWords(found) } words`)
    return { text: formatEstimate(found, missing, !!include_summary) }
  }

  // read: mark all as seen so later edits don't hit stale-check
  for (const entry of found) markSeen(entry)
  ev.ok(`${ found.length } entries, ${ totalWords(found) } words`)
  return { text: formatRead(found, missing) }
}
