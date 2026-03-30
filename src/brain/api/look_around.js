import { store }     from '../modules/store.js'
import { config }    from '../config.js'
import { findScope } from '../modules/organize.js'
import { createBus } from '../lib/bus.js'

const bus = createBus('look_around')

export async function handleLookAround () {
  const scopes = config.organize?.scopes || []
  bus.info(`${ store.entries.size } entries, ${ scopes.length } scopes`)
  const scopeCounts = new Map()
  const tags = new Map()

  for (const entry of store.entries) {
    const scope = findScope(entry)
    const name = scope?.name || '(no scope)'
    scopeCounts.set(name, (scopeCounts.get(name) || 0) + 1)

    for (const tag of entry.tags || []) {
      tags.set(tag, (tags.get(tag) || 0) + 1)
    }
  }

  let result = `# ${ config.name }\n\n`
  result += `Total: ${ store.entries.size } entries\n`
  if (config.normalizeTypography) {
    result += `> Typography normalization is ON — all dashes are normalized to \`-\` across all docs.\n`
  }
  result += '\n'

  if (scopes.length) {
    result += `> Scopes are macro-filters. Use { scope: "Name" } with search, grep, what_is, fields, diagnostic to narrow results.\n\n`

    for (const scope of scopes) {
      const count = scopeCounts.get(scope.name) || 0
      const doc = store.entries.get(scope.name)

      result += `## ${ scope.name } (${ count } entries)\n`
      if (doc?.summary) result += `${ doc.summary }\n`
      result += `\`{ scope: "${ scope.name }" }\``
      if (scope.match?.tag && scope.match?.field) {
        result += ` — matches tag prefix "${ scope.match.tag }" AND ${ scope.match.field } = "${ scope.match.value }"`
      } else if (scope.match?.tag) {
        result += ` — matches tag prefix "${ scope.match.tag }"`
      } else if (scope.match?.field) {
        result += ` — matches ${ scope.match.field } = "${ scope.match.value }"`
      }
      result += '\n'
      if (doc) result += `Details: [[${ scope.name }]]\n`
      result += '\n'
    }

    const unscoped = scopeCounts.get('(no scope)') || 0
    if (unscoped) result += `(no scope): ${ unscoped } entries\n\n`
  }

  // Tags
  const sortedTags = [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  result += `## Tags\n`
  for (const [name, count] of sortedTags) {
    result += `- ${ name } - ${ count }\n`
  }

  // Guideline
  const guidelineName = config.guideline
  if (guidelineName) {
    const entry = store.entries.get(guidelineName)
    if (entry) {
      result += `\n${ entry.content }`
    } else {
      result += `\n\nGuideline entry "${ guidelineName }" not found. Create it to provide working instructions for this knowledge base.`
    }
  }

  return { text: result.trimEnd() }
}
