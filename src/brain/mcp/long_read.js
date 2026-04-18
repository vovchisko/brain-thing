import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.LONG_READ,
  description: `Read or estimate size of multiple entries in one call. Prefer this over N separate get calls when processing a set of known entries.

operation: "estimate" — compact list with tags and word counts (+ summary if include_summary=true). Use this first when total size may be large.
operation: "read" — merged multi-entry view. Frontmatter fields shared by all entries (e.g. project, common tags) are hoisted into a header; each entry shows only its unique fields and full content. Marks all entries as seen so subsequent update/replace/insert work without a separate get.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [ 'estimate', 'read' ],
        description: 'estimate = preview sizes; read = full content',
      },
      documents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exact entry names (case-insensitive). Non-existent names are reported at the end, not fatal.',
      },
      include_summary: {
        type: 'boolean',
        description: 'For estimate only: include summary line per entry',
      },
    },
    required: [ 'operation', 'documents' ],
  },
}

export const route = { method: 'POST', path: TOOLS.LONG_READ }
