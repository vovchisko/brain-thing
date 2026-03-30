import path       from 'path'
import { config } from '../config.js'


/** Match entry against a condition: { field, value } or { tag } */
export function matchCondition(entry, cond) {
  if (!cond) return false
  const tagOk = !cond.tag || entry.tags?.some(t => t === cond.tag || t.startsWith(cond.tag + '/'))
  const fieldOk = !cond.field || entry[cond.field] === cond.value
  if (!cond.tag && !cond.field) return false
  return tagOk && fieldOk
}

/** Match entry against a rule (tag + field combo, at least one must be specified) */
function matchRule(entry, rule) {
  const tagOk = !rule.tag || entry.tags?.some(t => t === rule.tag || t.startsWith(rule.tag + '/'))
  const fieldOk = !rule.field || entry[rule.field] === rule.value
  return tagOk && fieldOk && (rule.tag || rule.field)
}

export function findScope(entry) {
  const scopes = config.organize?.scopes || []
  for (const scope of scopes) {
    if (matchCondition(entry, scope.match)) return scope
  }
  return null
}

export function resolveFolder(entry) {
  const org = config.organize
  if (!org?.useOrganize) return null

  const scope = findScope(entry)
  if (scope) {
    for (const rule of scope.rules || []) {
      if (matchRule(entry, rule)) return path.join(scope.folder, rule.folder)
    }
    return scope.folder
  }

  for (const rule of org.noScopeRules || []) {
    if (matchRule(entry, rule)) return rule.folder
  }

  return null
}

export function needsMove(entry, targetFolder) {
  if (!targetFolder || !entry.source_file) return false
  const rel = path.relative(config.vault, entry.source_file).replace(/\\/g, '/')
  const prefix = targetFolder.replace(/\\/g, '/') + '/'
  return !rel.startsWith(prefix)
}
