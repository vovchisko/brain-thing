/**
 * Normalize string for fuzzy matching.
 * Strips wikilink brackets, punctuation, collapses whitespace.
 * @param {string} str
 * @returns {string}
 */
export function normalize (str) {
  return str
      .toLowerCase()
      .replace(/^\[\[|\]\]$/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
}

/**
 * Strip wikilink brackets from string.
 * @param {string} str
 * @returns {string}
 */
export function stripBrackets (str) {
  return str.replace(/^\[\[|\]\]$/g, '').trim()
}

/**
 * Extract wikilinks from content (entry links only, skips file embeds).
 * Handles [[link]], [[link|display]], [[link#section]], [[link#section|display]].
 * @param {string} content
 * @returns {string[]} Array of linked entry names (without #section)
 */
export function extractWikilinks (content) {
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g
  const links = []
  let match
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim()
    if (!/\.\w{2,5}$/.test(name)) links.push(name)
  }
  return links
}

/**
 * Create debounced version of async function.
 * @param {Function} fn
 * @param {number} delay
 */
export function debounce (fn, delay) {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}


/** Order object keys: head → ...rest → tail */
export function orderKeys (obj, head = [], tail = []) {
  const entries = Object.entries(obj).filter(([ _, v ]) => v != null)
  const map = new Map(entries)
  const ordered = {}
  for (const k of head) {
    if (map.has(k)) {
      ordered[k] = map.get(k)
      map.delete(k)
    }
  }
  for (const [ k, v ] of map) { if (!tail.includes(k)) ordered[k] = v }
  for (const k of tail) { if (map.has(k)) ordered[k] = map.get(k) }
  return ordered
}

const BAD_CHARS = /[\\/:*?"<>|]/
const RESERVED = /^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i

/**
 * Validate entry name for filesystem safety.
 * @param {string} name
 * @returns {string|null} Error message or null if valid
 */
export function validateName (name) {
  if (!name || !name.trim()) return 'Name cannot be empty'
  if (name !== name.trim()) return 'Name cannot have leading/trailing spaces'
  if (BAD_CHARS.test(name)) return `Name contains invalid characters: \\ / : * ? " < > |`
  if (name.startsWith('.')) return 'Name cannot start with a dot'
  if (RESERVED.test(name)) return `"${ name }" is a reserved system name`
  if (name.length > 200) return 'Name too long (max 200 characters)'
  return null
}

/**
 * Validate folder path (one or more segments separated by /).
 * Each segment must be a valid directory name.
 * @param {string} folder
 * @returns {string|null} Error message or null if valid
 */
export function validateFolder (folder) {
  if (!folder || !folder.trim()) return 'Folder cannot be empty'
  const segments = folder.replace(/\\/g, '/').split('/').filter(Boolean)
  if (segments.length === 0) return 'Folder cannot be empty'
  const BAD_SEGMENT = /[:*?"<>|]/
  for (const seg of segments) {
    if (seg !== seg.trim()) return `Folder segment "${ seg }" has leading/trailing spaces`
    if (seg.startsWith('.')) return `Folder segment "${ seg }" cannot start with a dot`
    if (BAD_SEGMENT.test(seg)) return `Folder segment "${ seg }" contains invalid characters: : * ? " < > |`
    if (RESERVED.test(seg)) return `Folder segment "${ seg }" is a reserved system name`
  }
  return null
}

/**
 * Sanitize a key string for use as a filesystem-safe filename segment.
 * @param {string} key
 */
export function sanitizeName (key) {
  return key.replace(/[\\/:*?"<>|]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Navigate into an object using dot-notation path.
 * Array indices via numeric segments: 'items.0.name'
 * @param {*} obj
 * @param {string} [path]
 */
export function navigate (obj, path) {
  if (!path) return obj
  let cur = obj
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part]
  }
  return cur
}

/** Return Date object — js-yaml serializes natively without quoting */
export function formatDate (date) {
  return new Date(date)
}

/**
 * Check if entry has no meaningful content (only frontmatter).
 * @param {{ content?: string }} entry
 */
export function isEmptyEntry (entry) {
  return !entry.content || !entry.content.trim()
}

/** Count whitespace-separated words. Safe on empty/null. */
export function countWords (text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Build a human-readable listing of configured attributes.
 * @param {object} state - cfg.state (needs .vault.attributes)
 */
export function describeAttributes (state) {
  const attributes = state.vault.attributes || {}
  const lines = []
  for (const [name, type] of Object.entries(attributes)) {
    const desc = type.desc ? ` — ${ type.desc }` : ''
    lines.push(`- ${ name } (${ type.type })${ desc }`)
  }
  return lines.join('\n')
}

/**
 * Recursively freeze an object. No-op on primitives or already-frozen objects.
 */
export function deepFreeze (obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj)
    for (const v of Object.values(obj)) deepFreeze(v)
  }
  return obj
}

/** Structured deep clone for JSON-safe data. Throws on functions/classes. */
export function deepClone (obj) {
  return structuredClone(obj)
}

/**
 * Check if path should be ignored based on config.
 * @param {string} filePath - full path or relative path
 * @param {{ folders?: string[], patterns?: string[] }} ignore - ignore config
 */
export function shouldIgnore (filePath, ignore = {}) {
  const { folders = [], patterns = [] } = ignore
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const filename = parts[parts.length - 1]

  // Ignore dotfiles and dotfolders
  for (const part of parts) {
    if (part.startsWith('.')) return true
  }

  for (const folder of folders) {
    if (parts.includes(folder)) return true
  }

  const filenameLower = filename.toLowerCase()
  for (const pattern of patterns) {
    if (filenameLower.includes(pattern.toLowerCase())) return true
  }

  return false
}
