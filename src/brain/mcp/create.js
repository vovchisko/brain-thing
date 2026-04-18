import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.CREATE,
  description: `Create a new entry.

Requires name, content, and at least one tag. Pass extra frontmatter fields (project, status, priority, due, etc.) as top-level JSON keys.

When the vault has projects (see look_around), attach the entry to one by passing project: "<name>". Omit only if this entry genuinely belongs to no project.

Example: { name: "My Task", content: "...", tags: ["work"], project: "Work", status: "active", priority: 3 }`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name (becomes filename)' },
      content: { type: 'string', description: 'Content (markdown, supports [[wikilinks]])' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags (required, non-empty)' },
      project: { type: 'string', description: 'Attach to existing project from look_around' },
    },
    additionalProperties: true,
    required: ['name', 'content', 'tags'],
  },
}

export const injectFields = 'write'

export const route = { method: 'POST', path: TOOLS.CREATE }
