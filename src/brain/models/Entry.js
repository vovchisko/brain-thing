import { countWords } from '../lib/utils.js'
import { cfg }        from '../config.js'

/**
 * @typedef {Object} EntryData
 * @property {string} name
 * @property {string[]} [tags]
 * @property {string} [project]
 * @property {string} [source_file]
 * @property {string} [content_hash]
 * @property {string[]} [aliases]
 * @property {string} [summary]
 * @property {string|Date} [created]
 * @property {string|Date} [modified]
 * @property {string} content
 */

const BANNED_ATTRS = new Set(['name', 'content', 'created', 'modified', 'source_file', 'content_hash'])

/**
 * Validate an attributes map against the configured attribute types.
 * Returns { props, errors } — props is the cleaned subset that passed validation.
 * - Banned keys rejected
 * - "tags" required to be a non-empty array (no null/empty allowed)
 * - Any attribute typed as `list` must be an array, or null to remove
 * - Other types pass through
 * Pass extraBanned to forbid additional keys.
 */
export function validateAttributes (attrs, extraBanned = null) {
  const banned = extraBanned ? new Set([...BANNED_ATTRS, ...extraBanned]) : BANNED_ATTRS
  const types = cfg.state.vault.attributes || {}
  const errors = []
  const props = {}
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return { props, errors }
  for (const [key, value] of Object.entries(attrs)) {
    if (banned.has(key)) {
      errors.push({ index: null, type: 'attribute', reason: `"${ key }" cannot be set via attributes` })
      continue
    }
    if (key === 'tags') {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push({ index: null, type: 'attribute', reason: '"tags" must be a non-empty array' })
        continue
      }
    } else if (types[key]?.type === 'list') {
      // list attributes: null deletes; otherwise must be array
      if (value !== null && !Array.isArray(value)) {
        errors.push({ index: null, type: 'attribute', reason: `"${ key }" must be an array (or null to remove)` })
        continue
      }
    }
    props[key] = value
  }
  return { props, errors }
}

function countOccurrences (haystack, needle) {
  if (!needle) return 0
  return haystack.split(needle).length - 1
}

function applyReplace (content, { old, new: replacement, all }) {
  if (typeof old !== 'string' || typeof replacement !== 'string') return { error: 'replace: "old" and "new" must be strings' }
  if (old === '') return { error: 'replace: "old" must be non-empty' }
  const count = countOccurrences(content, old)
  if (count === 0) return { error: `replace: "old" not found` }
  if (count > 1 && !all) return { error: `replace: "old" matched ${ count } times (set "all": true or be more specific)` }
  const out = all ? content.split(old).join(replacement) : content.replace(old, replacement)
  return { ok: out }
}

function applyRemove (content, { text, all }) {
  if (typeof text !== 'string') return { error: 'remove: "text" must be a string' }
  if (text === '') return { error: 'remove: "text" must be non-empty' }
  const count = countOccurrences(content, text)
  if (count === 0) return { error: `remove: "text" not found` }
  if (count > 1 && !all) return { error: `remove: "text" matched ${ count } times (set "all": true or be more specific)` }
  const out = all ? content.split(text).join('') : content.replace(text, '')
  return { ok: out }
}

function applyInsert (content, { text, marker, position }) {
  if (typeof text !== 'string') return { error: 'insert: "text" must be a string' }

  if (marker !== undefined && marker !== null && marker !== '') {
    if (typeof marker !== 'string') return { error: 'insert: "marker" must be a string' }
    if (position !== 'before' && position !== 'after') return { error: 'insert: with marker, "position" must be "before" or "after"' }
    const idx = content.indexOf(marker)
    if (idx === -1) return { error: `insert: marker not found` }
    if (content.indexOf(marker, idx + 1) !== -1) return { error: `insert: marker matched more than once (use a more specific anchor)` }
    const at = position === 'before' ? idx : idx + marker.length
    return { ok: content.slice(0, at) + text + content.slice(at) }
  }

  const pos = position || 'end'
  if (pos === 'start') return { ok: text + content }
  if (pos === 'end') return { ok: content + text }
  return { error: 'insert: without marker, "position" must be "start" or "end"' }
}

function applyRewrite (_content, { content: newContent }) {
  if (typeof newContent !== 'string') return { error: 'rewrite: "content" must be a string' }
  return { ok: newContent }
}

const OP_HANDLERS = {
  replace: applyReplace,
  remove:  applyRemove,
  insert:  applyInsert,
  rewrite: applyRewrite,
}

export class Entry {
  /**
   * @param {EntryData} data
   */
  constructor (data) {
    this.name = data.name
    this.project = data.project || null
    this.tags = data.tags || []
    this.source_file = data.source_file || null
    this.content_hash = data.content_hash || null
    this.aliases = data.aliases || []
    this.created = data.created || null
    this.modified = data.modified || null
    this.summary = data.summary || null
    this.content = data.content

    // Non-enumerable so wordCount never leaks into frontmatter dumps, field stats, or searchable text
    Object.defineProperty(this, 'wordCount', {
      value: countWords(data.content),
      writable: true,
      enumerable: false,
      configurable: true,
    })

    // Preserve extra frontmatter fields (action_id, status, hand, etc.)
    for (const [ key, value ] of Object.entries(data)) {
      if (!(key in this)) this[key] = value
    }

    // Non-enumerable runtime maps
    Object.defineProperty(this, 'vectors', {
      value: new Map(),
      writable: false,
      enumerable: false,
      configurable: false,
    })
    Object.defineProperty(this, 'issues', {
      value: new Map(),
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }

  /**
   * Set a vector for this entry
   * @param {string} key - Vector key ('default', 'chunk_0', etc.)
   * @param {string} text - Source text that was embedded
   * @param {string} hash - SHA256 of text
   * @param {Float32Array} vector - The embedding vector
   */
  setVector (key, text, hash, vector) {
    this.vectors.set(key, { text, hash, vector })
  }

  /**
   * Project the result of an edit without mutating this entry.
   * Returns either { content, props, warnings } on success or { errors } on failure.
   * Caller persists via obsidian.updateFile.
   */
  applyEdits ({ operations, attributes } = {}) {
    const ops = Array.isArray(operations) ? operations : []
    const attrs = (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) ? attributes : null
    const errors = []

    if (ops.length === 0 && !attrs) {
      errors.push({ index: null, type: null, reason: 'provide "operations" and/or "attributes"' })
      return { errors }
    }

    // Rewrite-must-be-sole check
    if (ops.length > 1) {
      for (let i = 0; i < ops.length; i++) {
        if (ops[i]?.op === 'rewrite') {
          errors.push({ index: i, type: 'rewrite', reason: 'rewrite must be the only operation' })
        }
      }
    }

    // Apply ops to a working content string
    let working = this.content || ''
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      if (!op || typeof op !== 'object') {
        errors.push({ index: i, type: null, reason: 'op must be an object' })
        continue
      }
      const handler = OP_HANDLERS[op.op]
      if (!handler) {
        errors.push({ index: i, type: op.op, reason: `unknown op "${ op.op }"` })
        continue
      }
      const res = handler(working, op)
      if (res.error) {
        errors.push({ index: i, type: op.op, reason: res.error })
        // Keep walking against the pre-op state so we surface independent errors,
        // but ops after a failure don't see partial progress that never happened.
        continue
      }
      working = res.ok
    }

    // Validate attributes
    const { props, errors: attrErrors } = validateAttributes(attrs)
    errors.push(...attrErrors)

    if (errors.length > 0) return { errors }
    return { content: working, props }
  }
}
