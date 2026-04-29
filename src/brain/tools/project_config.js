import { TOOLS }                          from '../../shared/constants.js'
import { cfg }                            from '../config.js'
import { obsidian }                       from '../modules/obsidian.js'
import { findEntry, markSeen }            from './_helpers.js'
import { validateName, validateFolder }   from '../lib/utils.js'
import { ApiError }                       from '../lib/api.js'
import { createBus }                      from '../lib/bus.js'

const bus = createBus('project_config')

export const tool = {
  name: TOOLS.PROJECT_CONFIG,
  description: `Manage projects in the knowledge base.

Without parameters: lists all projects with their organization rules.

With "project" + "folder": creates or updates a project.
- folder: organization group name (e.g. "Brain Thing", "My Novel")
- rules: optional sub-organization rules within the project

With "project" + "remove": true — removes project from config (entries stay untouched).

On create, a home entry [[project]] is auto-created if it doesn't exist — update it with project guidelines.`,
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'Project key (short, e.g. "BT", "EO"). Also becomes the home entry name.' },
      folder: { type: 'string', description: 'Organization group for this project\'s entries' },
      rules: {
        type: 'array',
        description: 'Sub-organization rules (tag or field match → subfolder)',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag to match (prefix match)' },
            field: { type: 'string', description: 'Field name to match' },
            value: { type: 'string', description: 'Field value to match' },
            folder: { type: 'string', description: 'Subfolder within project folder' },
          },
          required: ['folder'],
        },
      },
      remove: { type: 'boolean', description: 'Remove project from config (entries stay)' },
    },
  },
}

function formatProject (key, proj) {
  let out = `**${ key }** → ${ proj.folder }`
  if (proj.rules?.length) {
    for (const r of proj.rules) {
      const match = r.tag ? `tag: ${ r.tag }` : `${ r.field }=${ r.value }`
      out += `\n  - ${ match } → ${ r.folder }`
    }
  }
  return out
}

export async function handle ({ project, folder, rules, remove } = {}) {
  const config = cfg.state
  const projects = config.vault.organize?.projects || {}

  if (!project) {
    const keys = Object.keys(projects)
    if (keys.length === 0) return { text: 'No projects configured.' }
    bus.info(`list (${ keys.length })`)
    let out = `${ keys.length } projects:\n\n`
    for (const key of keys) out += formatProject(key, projects[key]) + '\n'
    return { text: out.trimEnd() }
  }

  if (remove) {
    if (!projects[project]) {
      return { text: `Project "${ project }" not found in config.` }
    }
    const updated = { ...projects }
    delete updated[project]
    cfg.vault.set({ organize: { ...config.vault.organize, projects: updated } })
    bus.info(project, 'removed')
    return { text: `Project "${ project }" removed from config. Entries with project: "${ project }" are untouched.` }
  }

  const keyError = validateName(project)
  if (keyError) throw new ApiError(400, `Invalid project key: ${ keyError }`)

  if (!folder) {
    if (projects[project]) {
      return { text: formatProject(project, projects[project]) }
    }
    return { text: `Project "${ project }" not found. Provide "folder" to create it.` }
  }

  const folderError = validateFolder(folder)
  if (folderError) throw new ApiError(400, `Invalid folder: ${ folderError }`)
  for (const r of (rules || [])) {
    if (r.folder) {
      const ruleError = validateFolder(r.folder)
      if (ruleError) throw new ApiError(400, `Invalid rule folder "${ r.folder }": ${ ruleError }`)
    }
  }

  const isNew = !projects[project]
  const entry = { folder, rules: rules || projects[project]?.rules || [] }
  const updated = { ...projects, [project]: entry }
  cfg.vault.set({ organize: { ...config.vault.organize, projects: updated } })

  const ev = bus.op(project, folder)
  const parts = [isNew ? `Created project "${ project }"` : `Updated project "${ project }"`]
  parts.push(`Folder: ${ folder }`)
  if (entry.rules.length) parts.push(`Rules: ${ entry.rules.length }`)

  if (isNew && !findEntry(project)) {
    try {
      await obsidian.createFile(project, '', {
        project,
        tags: [project.toLowerCase()],
        summary: `${ folder } project`,
      })
      markSeen(findEntry(project))
      parts.push(`Home entry [[${ project }]] created — update it with project guidelines.`)
    } catch (err) {
      parts.push(`Could not create home entry: ${ err.message }`)
    }
  }

  ev.ok(isNew ? 'created' : 'updated')
  return { text: parts.join('\n') }
}
