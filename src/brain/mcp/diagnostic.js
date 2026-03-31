import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.DIAGNOSTIC,
  description: `Report entries with issues. Categories:
- links: broken [[wikilinks]] pointing to non-existent entries
- summary: entries missing a summary field (needed for semantic search quality)
- tts: TTS chunking problems (oversized chunks, bad punctuation for synthesis)

Filter by category, project, or tags. Shows up to 20 entries per category.`,
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['links', 'summary', 'tts'], description: 'Filter by issue type (omit for all)' },
      project: { type: 'string', description: 'Filter by project' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
    },
  },
}

export const route = { method: 'POST', path: TOOLS.DIAGNOSTIC }
