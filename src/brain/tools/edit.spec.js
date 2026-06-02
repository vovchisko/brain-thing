import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.EDIT,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.CORE,
  description: `Edit an entry. Ordered body operations and/or attribute updates, applied atomically — every op is validated against the projected result first; if any fails, nothing is written.`,
  inputSchema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'Entry name (case-insensitive).' },
      operations: {
        type: 'array',
        minItems: 1,
        description: 'Body edits applied in array order — each op sees the result of the previous one. A `rewrite` op must be the only operation.',
        items: {
          oneOf: [
            {
              title: 'replace',
              type: 'object',
              required: ['op', 'old', 'new'],
              properties: {
                op: { const: 'replace' },
                old: { type: 'string', description: 'Exact text to find.' },
                new: { type: 'string', description: 'Replacement text.' },
                all: { type: 'boolean', default: false, description: 'Replace every match. If false, "old" must match exactly once.' },
              },
            },
            {
              title: 'remove',
              type: 'object',
              required: ['op', 'text'],
              properties: {
                op: { const: 'remove' },
                text: { type: 'string', description: 'Exact text to delete.' },
                all: { type: 'boolean', default: false, description: 'Delete every match. If false, "text" must match exactly once.' },
              },
            },
            {
              title: 'insert',
              type: 'object',
              required: ['op', 'text'],
              properties: {
                op: { const: 'insert' },
                text: { type: 'string', description: 'Text to insert. No whitespace is added — include any needed "\\n".' },
                marker: { type: 'string', description: 'Unique substring in content; omit for positional insert.' },
                position: { type: 'string', enum: ['before', 'after', 'start', 'end'], description: 'With marker: before | after. Without marker: start | end.' },
              },
            },
            {
              title: 'rewrite',
              type: 'object',
              required: ['op', 'content'],
              properties: {
                op: { const: 'rewrite' },
                content: { type: 'string', description: 'New full body. Must be the only operation in the list.' },
              },
            },
          ],
        },
      },
      attributes: {
        type: 'object',
        minProperties: 1,
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}
