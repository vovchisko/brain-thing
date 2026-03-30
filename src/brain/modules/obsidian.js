import fs                                                           from 'fs/promises'
import path                                                         from 'path'
import crypto                                                       from 'crypto'
import matter                                                       from 'gray-matter'
import { store }                                                    from './store.js'
import { embeddings }                                               from './embeddings.js'
import { createBus }                                                from '../lib/bus.js'
import { config }                                                   from '../config.js'
import { formatDate, normalizeTypography, orderKeys, shouldIgnore } from '../lib/utils.js'
import { needsMove, resolveFolder }                                 from './organize.js'

const bus = createBus('obsidian', { system: true })

function coerceFields (data) {
  for (const [ name, type ] of Object.entries(config.fields)) {
    if (name in data) data[name] = type.parse(data[name])
  }
  return data
}

function serializeFields (data) {
  const out = { ...data }
  for (const [ name, type ] of Object.entries(config.fields)) {
    if (name in out) out[name] = type.serialize(out[name])
  }
  return out
}


const filenameCache = new Map()
const importedFiles = new Set()

function computeHash (content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function stampNew (props) {
  const now = formatDate(new Date())
  if (!props.created) props.created = now
  props.modified = now
}

async function findFile (filename) {
  const cached = filenameCache.get(filename)
  if (cached) {
    try {
      await fs.access(cached)
      return cached
    } catch {
      filenameCache.delete(filename)
    }
  }

  try {
    const entries = await fs.readdir(config.vault, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name === filename) {
        const fullPath = path.join(entry.parentPath || entry.path || config.vault, entry.name)
        if (shouldIgnore(fullPath, config.ignore)) continue
        filenameCache.set(filename, fullPath)
        return fullPath
      }
    }
  } catch (err) {
    // ignore
  }

  return null
}

/**
 * @param {string} text
 * @returns {{ frontmatter: object, content: string } | null}
 */
function parseFrontmatter (text) {
  try {
    const { data, content } = matter(text)
    return { frontmatter: data, content }
  } catch (err) {
    return null
  }
}

/**
 * @param {object} frontmatter
 * @param {string} content
 * @returns {string}
 */
function serializeFrontmatter (frontmatter, content = '') {
  const serialized = serializeFields(frontmatter)
  const ordered = orderKeys(serialized, config.frontmatterHead, config.frontmatterTail)
  return matter.stringify(content, ordered)
}

/**
 * @param {object} frontmatter
 * @param {string} filePath
 * @returns {string|null}
 */
function validateFrontmatter (frontmatter, filePath) {
  // Minimal validation - just need valid frontmatter object
  if (!frontmatter || typeof frontmatter !== 'object') {
    return `Invalid frontmatter: ${ filePath }`
  }
  return null
}

/**
 * Delete entries matching file path or name.
 * @param {string} filePath
 * @param {string} [name] - Optional name to also match
 * @returns {number} Count of deleted entries
 */
function deleteEntriesForFile (filePath, name) {
  const toDelete = store.entries.filter(e =>
      e.source_file === filePath || (name && e.name === name),
  ).map(e => e.name)
  for (const n of toDelete) store.entries.delete(n)
  return toDelete.length
}

function shouldEmbed (entry) {
  const skip = config.embeddings.skipTags
  if (!skip || !skip.length) return true
  const tags = entry.tags || []
  return !tags.some(t => skip.includes(t))
}

async function generateVector (entry) {
  if (!shouldEmbed(entry)) return
  const text = entry.summary
      ? `${ entry.name }\n\n${ entry.summary }`
      : `${ entry.name }\n\n${ entry.content }`
  const hash = embeddings.hashContent(text)
  const vector = await embeddings.getVector(text, entry.name)
  entry.setVector('default', text, hash, vector)
}

/**
 * @param {string} filePath
 */
async function importFile (filePath) {
  const raw = await fs.readFile(filePath, 'utf-8')
  const text = config.normalizeTypography ? normalizeTypography(raw) : raw
  const parsed = parseFrontmatter(text)

  if (!parsed) {
    bus.warn('import', `Invalid YAML in ${ path.basename(filePath) }`)
    return
  }

  const { frontmatter, content } = parsed
  const validationError = validateFrontmatter(frontmatter, filePath)
  if (validationError) {
    bus.warn('import', validationError)
    return
  }

  const fileHash = computeHash(text)
  const fileName = path.basename(filePath, '.md')

  importedFiles.add(filePath)
  filenameCache.set(path.basename(filePath), filePath)

  // Skip if content unchanged
  const existing = store.entries.find(e => e.source_file === filePath)
  if (existing && existing.content_hash === fileHash) return

  bus.info('import', `+ ${ fileName }`)

  const stat = await fs.stat(filePath)
  const created = frontmatter.created || formatDate(stat.birthtime)
  const fmModified = frontmatter.modified ? new Date(frontmatter.modified) : new Date(0)
  const modified = formatDate(fmModified > stat.mtime ? fmModified : stat.mtime)

  const entry = {
    ...frontmatter,
    name: fileName,
    content: content.trim(),
    source_file: filePath,
    content_hash: fileHash,
    tags: frontmatter.tags || [],
    aliases: frontmatter.aliases || [],
    created,
    modified,
  }

  coerceFields(entry)

  deleteEntriesForFile(filePath, fileName)
  const entryInstance = store.entries.add(entry)
  await generateVector(entryInstance)
}

/**
 * @param {string} dir
 */
async function scanDirectory (dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (shouldIgnore(fullPath, config.ignore)) continue

    if (entry.isDirectory()) {
      await scanDirectory(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      try {
        await importFile(fullPath)
      } catch (err) {
        bus.error(`Failed: ${ fullPath } — ${ err.message }`)
      }
    }
  }
}

/**
 * Update entry content and frontmatter.
 * @param {object} entry - Entry to update
 * @param {string} content - New content
 * @param {object} updatedProps - Frontmatter properties to update
 * @returns {Promise<string>} Updated file path
 */
async function updateFile (entry, content, updatedProps = {}) {
  let filePath = entry.source_file

  // Try to find the file
  if (filePath) {
    try {
      await fs.access(filePath)
    } catch (accessErr) {
      bus.warn('file', `Not at source_file: ${ filePath } (${ accessErr.code })`)
      const filename = path.basename(filePath)
      const found = await findFile(filename)
      if (found) {
        filePath = found
        bus.info('file', `Found at: ${ filePath }`)
      } else {
        bus.warn('file', `Not found by basename: ${ filename }`)
        filePath = null
      }
    }
  }

  // No source_file - try to find by name
  if (!filePath) {
    const filename = `${ entry.name }.md`
    bus.info('file', `Searching by entry name: ${ filename }`)
    const found = await findFile(filename)
    if (found) {
      filePath = found
      bus.info('file', `Found at: ${ filePath }`)
    } else {
      bus.error('file', `Not found for entry: ${ entry.name }`)
      throw new Error(`File not found for entry: "${ entry.name }"`)
    }
  }

  const existingContent = await fs.readFile(filePath, 'utf-8')
  const parsed = parseFrontmatter(existingContent)

  if (!parsed) {
    throw new Error(`Invalid YAML in file - fix manually: ${ filePath }`)
  }

  const { frontmatter } = parsed

  // Apply updates to frontmatter
  for (const [ key, value ] of Object.entries(updatedProps)) {
    if (value !== null && value !== undefined) {
      frontmatter[key] = value
    }
  }

  frontmatter.modified = formatDate(new Date())
  if (!frontmatter.created) {
    const stat = await fs.stat(filePath)
    frontmatter.created = formatDate(stat.birthtime)
  }

  const fileContent = serializeFrontmatter(frontmatter, content)
  await fs.writeFile(filePath, fileContent, 'utf-8')

  // Re-import immediately so store is updated
  await importFile(filePath)
  await organizeFile(entry.name)

  return filePath
}

/**
 * Create new markdown file in input folder.
 * @param {string} name - Entry name (becomes filename)
 * @param {string} content - Entry content
 * @param {object} props - Frontmatter properties
 * @returns {Promise<string>} Created file path
 */
async function createFile (name, content, props = {}) {
  const filename = `${ name }.md`
  const existing = await findFile(filename)
  if (existing) {
    throw new Error(`File already exists: ${ filename }`)
  }

  stampNew(props)

  const folder = resolveFolder(props) || config.organize.default
  const dir = path.join(config.vault, folder)
  await fs.mkdir(dir, { recursive: true })

  const fileContent = serializeFrontmatter(props, content)
  const filePath = path.join(dir, filename)

  await fs.writeFile(filePath, fileContent, 'utf-8')
  filenameCache.set(filename, filePath)

  // Import immediately so entry is available before watcher triggers
  await importFile(filePath)

  return filePath
}

/**
 * Delete entry and its source file.
 * Handles cases where entry has no source_file or file is already gone.
 * @param {object} entry - Entry to delete
 * @returns {Promise<string|null>} Deleted file path or null if no file
 */
async function deleteFile (entry) {
  let filePath = entry.source_file
  let fileDeleted = false

  // Try to find and delete the file
  if (filePath) {
    try {
      await fs.access(filePath)
      await fs.unlink(filePath)
      fileDeleted = true
    } catch {
      // File not at source_file path, try to find it
      const filename = path.basename(filePath)
      const found = await findFile(filename)
      if (found) {
        await fs.unlink(found)
        filePath = found
        fileDeleted = true
      }
    }
  } else {
    // No source_file - try to find by name
    const filename = `${ entry.name }.md`
    const found = await findFile(filename)
    if (found) {
      await fs.unlink(found)
      filePath = found
      fileDeleted = true
    }
  }

  // Always remove entry from store (by id and name to catch duplicates)
  deleteEntriesForFile(filePath || '', entry.name)

  // Clear from caches
  if (filePath) {
    filenameCache.delete(path.basename(filePath))
    importedFiles.delete(filePath)
  }

  return fileDeleted ? filePath : null
}

async function stampMissingDates () {
  let count = 0

  for (const entry of store.entries) {
    if (!entry.source_file) continue

    const raw = await fs.readFile(entry.source_file, 'utf-8')
    const parsed = parseFrontmatter(raw)
    if (!parsed) continue

    const { frontmatter, content } = parsed
    const needsCreated = !frontmatter.created
    const needsModified = !frontmatter.modified
    if (!needsCreated && !needsModified) continue

    if (needsCreated) frontmatter.created = entry.created
    if (needsModified) frontmatter.modified = entry.modified

    const updated = serializeFrontmatter(frontmatter, content)
    await fs.writeFile(entry.source_file, updated, 'utf-8')
    count++
  }

  if (count > 0) bus.info('dates', `Stamped dates on ${ count } files`)
}

async function organizeFile (entryOrName) {
  const entry = typeof entryOrName === 'string'
      ? store.entries.get(entryOrName)
      : entryOrName
  if (!entry?.source_file) return

  const target = resolveFolder(entry)
  if (!target || !needsMove(entry, target)) return

  const targetDir = path.join(config.vault, target)
  await fs.mkdir(targetDir, { recursive: true })

  const filename = path.basename(entry.source_file)
  const newPath = path.join(targetDir, filename)

  await fs.rename(entry.source_file, newPath)
  filenameCache.set(filename, newPath)
  await importFile(newPath)

  bus.info('organize', `Moved: ${ filename } → ${ target }`)
}

async function run () {
  const t0 = Date.now()
  bus.info('scan', 'Starting import...')
  importedFiles.clear()

  try {
    await fs.mkdir(path.join(config.vault, config.organize.default), { recursive: true })
  } catch (err) {
    // Ignore if exists
  }

  bus.info('scan', `Scanning ${ config.vault }`)

  try {
    await scanDirectory(config.vault)
  } catch (err) {
    bus.error(`Failed to scan ${ config.vault } — ${ err.message }`)
  }

  // Remove orphans: entries with no source_file or stale source_file
  const orphans = store.entries.filter(e => !e.source_file || !importedFiles.has(e.source_file))

  for (const entry of orphans) {
    const reason = !entry.source_file ? 'no source_file' : 'file not found'
    bus.info('orphan', `- ${ entry.name } (${ reason })`)
    store.entries.delete(entry.name)
  }

  // Persist missing dates into frontmatter
  await stampMissingDates()

  // Auto-organize entries by scope rules
  for (const entry of [ ...store.entries ]) {
    await organizeFile(entry)
  }

  bus.info('scan', `Import complete: ${ store.entries.size } entries in ${ ((Date.now() - t0) / 1000).toFixed(1) }s`)
}

async function syncFiles (filePaths) {
  const toImport = []
  const toDelete = []

  // Separate existing files from deleted ones
  for (const filePath of filePaths) {
    try {
      await fs.access(filePath)
      toImport.push(filePath)
    } catch {
      toDelete.push(filePath)
    }
  }

  // Import existing files first (handles moves - new location imported)
  for (const filePath of toImport) {
    await importFile(filePath)
  }

  // Then handle deletions (old paths that no longer exist)
  for (const filePath of toDelete) {
    const deleted = deleteEntriesForFile(filePath)
    if (deleted > 0) {
      bus.info('sync', `- ${ path.basename(filePath, '.md') }`)
    }
  }
}

async function writeToFolder (folder, name, content, props = {}) {
  const filename = `${ name }.md`
  const existing = await findFile(filename)
  if (existing) {
    throw new Error(`File already exists: ${ filename }`)
  }

  const dir = path.join(config.vault, folder)
  await fs.mkdir(dir, { recursive: true })

  stampNew(props)

  const fileContent = serializeFrontmatter(props, content)
  const filePath = path.join(dir, filename)

  await fs.writeFile(filePath, fileContent, 'utf-8')
  filenameCache.set(filename, filePath)

  await importFile(filePath)

  return filePath
}

function buildWikilinkRegex (name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\[\\[${ escaped }(#[^\\]|]*)?(\\|[^\\]]+)?\\]\\]`, 'gi')
}

/**
 * Rename entry file and update all wikilinks across the vault.
 * Mimics Obsidian rename behavior.
 * @param {object} entry - Entry to rename
 * @param {string} newName - New entry name
 * @returns {Promise<{ renamed: string, updatedFiles: number }>}
 */
async function renameFile (entry, newName) {
  if (!entry.source_file) {
    throw new Error(`Entry "${ entry.name }" has no source file`)
  }

  const oldName = entry.name
  const oldPath = entry.source_file
  const newPath = path.join(path.dirname(oldPath), `${ newName }.md`)

  // Check target doesn't exist
  const existing = await findFile(`${ newName }.md`)
  if (existing) {
    throw new Error(`Entry "${ newName }" already exists`)
  }

  // Build regex for wikilink replacement
  const regex = buildWikilinkRegex(oldName)

  // Find and update all referencing files
  let updatedFiles = 0
  for (const ref of store.entries) {
    if (ref.name === oldName) continue
    if (!ref.source_file) continue

    let raw
    try {
      raw = await fs.readFile(ref.source_file, 'utf-8')
    } catch {
      continue
    }

    // Reset regex lastIndex for each file
    regex.lastIndex = 0
    if (!regex.test(raw)) continue

    regex.lastIndex = 0
    const updated = raw.replace(regex, `[[${ newName }$1$2]]`)
    await fs.writeFile(ref.source_file, updated, 'utf-8')
    await importFile(ref.source_file)
    updatedFiles++
  }

  // Rename the target file
  await fs.rename(oldPath, newPath)

  // Update caches
  filenameCache.delete(path.basename(oldPath))
  filenameCache.set(`${ newName }.md`, newPath)
  importedFiles.delete(oldPath)

  // Re-import under new name
  deleteEntriesForFile(oldPath, oldName)
  await importFile(newPath)

  bus.info('rename', `${ oldName } → ${ newName } (${ updatedFiles } refs updated)`)

  return { renamed: newPath, updatedFiles }
}

export const obsidian = {
  run,
  syncFiles,
  findFile,
  createFile,
  writeToFolder,
  updateFile,
  deleteFile,
  renameFile,
}
