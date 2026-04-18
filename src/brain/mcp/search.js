import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.SEARCH,
  description: `Search entries by field values.

Returns a list with project/tags, a short preview, and word count — use \`get\` to read full content.

Use "fields" tool to discover available fields and their types.

Each filter: { field, value, op? }
- op defaults to "$eq" (exact match)
- String: $eq (exact match)
- Date: $eq, $gt, $gte, $lt, $lte — value as "YYYY-MM-DD"
- Number: $eq, $gt, $gte, $lt, $lte
- List (e.g. tags): $any (entry's list contains at least one of the given values), $all (contains all) — value is an array: ["val1", "val2"]`,
  inputSchema: {
    type: 'object',
    properties: {
      filters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: 'Field name' },
            value: { description: 'Value to compare' },
            op: { type: 'string', description: 'Operator: $eq (default), $gt, $gte, $lt, $lte, $any, $all' },
          },
          required: ['field', 'value'],
        },
        description: 'Array of field conditions',
      },
      project: { type: 'string', description: 'Pre-filter by project (from look_around)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Pre-filter by tags (prefix match, OR)' },
      limit: { type: 'number', description: 'Max results (default 50, max 200)' },
    },
    required: ['filters'],
  },
}

export const injectFields = 'search'

export const route = { method: 'POST', path: TOOLS.SEARCH }
