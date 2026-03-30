/**
 * @typedef {Object} EntryData
 * @property {string} name
 * @property {string[]} [tags]
 * @property {string} [source_file]
 * @property {string} [content_hash]
 * @property {string[]} [aliases]
 * @property {string[]} [related]
 * @property {string} [summary]
 * @property {string} content
 */

export class Entry {
  /**
   * @param {EntryData} data
   */
  constructor (data) {
    this.name = data.name
    this.tags = data.tags || []
    this.source_file = data.source_file || null
    this.content_hash = data.content_hash || null
    this.aliases = data.aliases || []
    this.created = data.created || null
    this.modified = data.modified || null
    this.summary = data.summary || null
    this.content = data.content

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

  /** @returns {string[]} Array of all vector hashes for cache management */
  get vectorHashes () {
    return Array.from(this.vectors.values()).map(v => v.hash)
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
   * Get a vector by key
   * @param {string} key
   * @returns {{ text: string, hash: string, vector: Float32Array } | undefined}
   */
  getVector (key) {
    return this.vectors.get(key)
  }

  /** Clear all vectors (for invalidation on content change) */
  clearVectors () {
    this.vectors.clear()
  }
}
