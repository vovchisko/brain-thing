/**
 * In-memory collection for model instances.
 * Uses both Map (O(1) lookup) and Array (insertion order + pagination).
 * No persistence - rebuilt from source files on startup.
 */
class Collection {
  /**
   * @param {Function} ModelClass
   * @param {Object} [options]
   * @param {number} [options.vectorDimensions]
   */
  constructor (ModelClass, options = {}) {
    this._map = new Map()
    this._array = []
    this._ModelClass = ModelClass
    this.vectorDimensions = options.vectorDimensions || null
  }

  get size () {
    return this._array.length
  }

  [Symbol.iterator] () {
    return this._array[Symbol.iterator]()
  }

  add (entityOrData) {
    const entity = entityOrData instanceof this._ModelClass
        ? entityOrData
        : new this._ModelClass(entityOrData, { vectorDimensions: this.vectorDimensions })

    if (!entity?.name) throw new Error('Entity must have a name')
    const key = entity.name.toLowerCase().trim()
    if (this._map.has(key)) throw new Error(`Entity "${ entity.name }" already exists`)

    this._map.set(key, entity)
    this._array.push(entity)
    return entity
  }

  /** Get by name (case-insensitive, trimmed) */
  get (name) {
    return this._map.get(name.toLowerCase().trim()) || null
  }

  delete (name) {
    const key = name.toLowerCase().trim()
    const entity = this._map.get(key)
    if (!entity) return false
    const idx = this._array.indexOf(entity)
    if (idx !== -1) this._array.splice(idx, 1)
    this._map.delete(key)
    return true
  }

  /** Filter by predicate */
  filter (predicate) {
    return this._array.filter(predicate)
  }

  /** Clear all entries */
  clear () {
    this._map.clear()
    this._array.length = 0
  }

}

export { Collection }
