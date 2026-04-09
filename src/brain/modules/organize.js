import path from 'path'

function matchRule (entry, rule) {
  const tagOk = !rule.tag || entry.tags?.some(t => t === rule.tag || t.startsWith(rule.tag + '/'))
  const fieldOk = !rule.field || entry[rule.field] === rule.value
  return (rule.tag || rule.field) && tagOk && fieldOk
}

function resolveFolder (entry, config) {
  const org = config.organize
  if (!org?.useOrganize) return null

  if (entry.project) {
    const proj = org.projects?.[entry.project]
    if (proj) {
      for (const rule of proj.rules || []) {
        if (matchRule(entry, rule)) return path.join(proj.folder, rule.folder)
      }
      return proj.folder
    }
  }

  for (const rule of org.rules || []) {
    if (matchRule(entry, rule)) return rule.folder
  }

  return null
}

function needsMove (entry, targetFolder, config) {
  if (!targetFolder || !entry.source_file) return false
  const rel = path.relative(config.vault, entry.source_file).replace(/\\/g, '/')
  const prefix = targetFolder.replace(/\\/g, '/') + '/'
  return !rel.startsWith(prefix)
}

export { resolveFolder, needsMove }
