import { TOOLS } from '../../shared/constants.js'

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

export const route = { method: 'POST', path: TOOLS.PROJECT_CONFIG }
