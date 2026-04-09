import { store }     from '../modules/store.js'
import { cfg }       from '../config.js'
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

  let result = `# ${ cfg.state.name }\n\n`

  // Guideline first
  const guidelineName = cfg.state.guideline
  if (guidelineName) {
    const entry = store.entries.get(guidelineName)
    if (entry) {
      result += `${ entry.content }\n\n`
    } else {
      result += `Guideline entry "${ guidelineName }" not found. Create it to provide working instructions for this knowledge base.\n\n`
    }
  }

  // Vault overview
  result += `Total: ${ store.entries.size } entries\n\n`

  // Projects
  if (projectList.some(([name]) => name !== '(no project)')) {
    for (const [name, count] of projectList) {
      if (name === '(no project)') continue
      const doc = store.entries.get(name)
      result += `## ${ name } (${ count } entries)\n`
      if (doc?.summary) result += `${ doc.summary }\n`
      if (doc) result += `Details: [[${ name }]]\n`
      result += '\n'
    }

    const noProj = projectCounts.get('(no project)') || 0
    if (noProj) result += `(no project): ${ noProj } entries\n\n`
  }

  // Tags
  const sortedTags = [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  result += `## Tags\n`
  for (const [name, count] of sortedTags) {
    result += `- ${ name } - ${ count }\n`
  }

  // Filter instructions last
  result += `\n> Use { project: "Name" } with search, grep, what_is, fields, diagnostic to filter by project.`
  result += `\n> Use { tags: ["prefix"] } for tag-based filtering (prefix match).`

  return { text: result.trimEnd() }
}
