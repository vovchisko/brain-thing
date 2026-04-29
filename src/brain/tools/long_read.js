import matter                  from 'gray-matter'
import { TOOLS }               from '../../shared/constants.js'
import { cfg }                 from '../config.js'
import { ApiError }            from '../lib/api.js'
import { orderKeys }           from '../lib/utils.js'
import { findEntry, markSeen } from './_helpers.js'
import { createBus }           from '../lib/bus.js'

const bus = createBus('long_read')

export const tool = {
  name: TOOLS.LONG_READ,
  description: `Read or estimate size of multiple entries in one call. Prefer this over N separate get calls when processing a set of known entries.

operation: "estimate" — compact list with tags and word counts (+ summary if include_summary=true). Use this first when total size may be large.
operation: "read" — merged multi-entry view. Frontmatter fields shared by all entries (e.g. project, common tags) are hoisted into a header; each entry shows only its unique fields and full content. Marks all entries as seen so subsequent update/replace/insert work without a separate get.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [ 'estimate', 'read' ],
        description: 'estimate = preview sizes; read = full content',
      },
      documents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exact entry names (case-insensitive). Non-existent names are reported at the end, not fatal.',
      },
      include_summary: {
        type: 'boolean',
        description: 'For estimate only: include summary line per entry',
      },
    },
    required: [ 'operation', 'documents' ],
  },
}

const HIDDEN = new Set(['name', 'content', 'source_file', 'content_hash', 'wordCount', 'created', 'modified'])

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

function extractCommon (entries) {
  const common = {}
  const perEntry = new Map()
  if (!entries.length) return { common, perEntry }

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
    if (Array.isArray(first)) continue
    if (entries.every(e => e[key] === first)) common[key] = first
  }

  if (entries.every(e => Array.isArray(e.tags))) {
    const intersection = entries[0].tags.filter(t => entries.every(e => e.tags.includes(t)))
    if (intersection.length) common.tags = intersection
  }

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

export async function handle ({ operation, documents, include_summary = false } = {}) {
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

  for (const entry of found) markSeen(entry)
  ev.ok(`${ found.length } entries, ${ totalWords(found) } words`)
  return { text: formatRead(found, missing) }
}
