import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.TAGS_LIST,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `List tags, or subtags under a prefix.`,
  inputSchema: {
    type: 'object',
    properties: {
      tag: { type: 'string', description: 'Tag prefix (e.g. "eo" or "eo/game")' },
    },
  },
}
