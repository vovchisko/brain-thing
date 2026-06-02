import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.LOOK_AROUND,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Knowledge-base overview.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
}
