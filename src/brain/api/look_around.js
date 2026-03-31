import { store }     from '../modules/store.js'
import { config }    from '../config.js'
import { createBus } from '../lib/bus.js'

const bus = createBus('look_around')

export async function handleLookAround () {
  const projectCounts = new Map()
  const tags = new Map()

  for (const entry of store.entries) {
    const proj = entry.project || '(no project)'
    projectCounts.set(proj, (projectCounts.get(proj) || 0) + 1)

    for (const tag of entry.tags || []) {
      tags.set(tag, (tags.get(tag) || 0) + 1)
    }
  }

  const projectList = [...projectCounts.entries()].sort((a, b) => b[1] - a[1])
  bus.info(`${ store.entries.size } entries, ${ projectList.length } projects`)

  let result = `# ${ config.name }\n\n`
  result += `Total: ${ store.entries.size } entries\n`
  if (config.normalizeTypography) {
    result += `> Typography normalization is ON — all dashes are normalized to \`-\` across all docs.\n`
  }
  result += '\n'

  // Projects
  if (projectList.some(([name]) => name !== '(no project)')) {
    result += `> Use { project: "Name" } with search, grep, what_is, fields, diagnostic to filter by project.\n\n`

    for (const [name, count] of projectList) {
      if (name === '(no project)') continue
      const doc = store.entries.get(name)
      result += `## ${ name } (${ count } entries)\n`
      if (doc?.summary) result += `${ doc.summary }\n`
      result += `\`{ project: "${ name }" }\`\n`
      if (doc) result += `Details: [[${ name }]]\n`
      result += '\n'
    }

    const unscoped = projectCounts.get('(no project)') || 0
    if (unscoped) result += `(no project): ${ unscoped } entries\n\n`
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
