import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.INSERT,
  description: `Insert text into entry content. Two modes:

Positional (no marker): inserts at "start" or "end" (default) of content.
Marker-based (with marker): inserts "before" or "after" a unique string in the content.

position + marker combinations:
- "end" (default, no marker) — append to content
- "start" (no marker) — prepend to content
- "before" + marker — insert before the marker string
- "after" + marker — insert after the marker string

No whitespace is added automatically — include any needed "\\n" in your text yourself. Examples:
- "\\n\\nNew paragraph." — append as a new paragraph
- " and more." — continue the last line inline
- "Header line\\n\\n" (prepend) — add header above existing content

Marker must appear exactly once in content — use "get" first to find unique text.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      text: { type: 'string', description: 'Text to insert' },
      marker: { type: 'string', description: 'Unique string to insert near (optional — omit to append/prepend)' },
      position: {
        type: 'string',
        enum: [ 'before', 'after', 'start', 'end' ],
        description: 'Where to insert (default: "end")',
      },
    },
    required: [ 'name', 'text' ],
  },
}

export const route = { method: 'POST', path: TOOLS.INSERT }
