import path                               from 'path'
import { store }                          from './store.js'
import { extractWikilinks, isEmptyEntry } from '../lib/utils.js'
import { createBus } from '../lib/bus.js'

const bus = createBus('diag', { system: true })

/**
 * Check missing/empty links for an entry.
 */
function checkLinks (entry) {
  const links = [ ...new Set(extractWikilinks(entry.content)) ]
  const problems = []

  for (const linkName of links) {
    if (linkName === entry.name) continue
    const target = store.entries.get(linkName)
    if (!target) {
      problems.push(`[[${ linkName }]] — missing`)
    } else if (isEmptyEntry(target)) {
      problems.push(`[[${ target.name }]] — empty`)
    }
  }

  if (problems.length) {
    entry.issues.set('links', problems)
  } else {
    entry.issues.delete('links')
  }
}

/**
 * Check if entry has a summary.
 */
function checkSummary (entry) {
  if (!entry.summary?.trim()) {
    entry.issues.set('summary', [ 'No summary' ])
  } else {
    entry.issues.delete('summary')
  }
}

/**
 * Run all checks on a single entry.
 */
function checkEntry (entry) {
  checkLinks(entry)
  checkSummary(entry)
}

/**
 * Run all checks on all entries. Call after obsidian.run().
 */
function checkAll () {
  let total = 0
  for (const entry of store.entries) {
    checkEntry(entry)
    if (entry.issues.size) total++
  }
  bus.info('check', `${ store.entries.size } entries, ${ total } with issues`)
}

/**
 * Run checks on specific entries (after file changes).
 */
function checkChanged (filePaths) {
  for (const fp of filePaths) {
    const name = path.basename(fp, '.md')
    const entry = store.entries.get(name)
    if (entry) checkEntry(entry)
  }
}

export const diagnostics = { checkAll, checkChanged, checkEntry }
