import matter        from 'gray-matter'
import { store }     from '../modules/store.js'
import { config }    from '../config.js'
import { orderKeys } from '../lib/utils.js'

const HIDDEN_FIELDS = new Set([ 'source_file', 'content_hash', 'content' ])

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
  const ordered = orderKeys(frontmatter, config.frontmatterHead, config.frontmatterTail)
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
