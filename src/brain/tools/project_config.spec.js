import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.PROJECT_CONFIG,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.SETTINGS,
  description: `List, create, update, or remove projects. Creating a project auto-creates its home entry.`,
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'Project key (short, e.g. "BT"); also the home entry name' },
      folder: { type: 'string', description: 'Folder name for this project\'s entries' },
      rules: {
        type: 'array',
        description: 'Sub-folder rules: tag prefix or attribute=value → subfolder',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag prefix match' },
            attribute: { type: 'string' },
            value: { type: 'string' },
            folder: { type: 'string', description: 'Subfolder within project folder' },
          },
          required: ['folder'],
        },
      },
      remove: { type: 'boolean', description: 'Remove from config; entries are not deleted.' },
    },
  },
}
