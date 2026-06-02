import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export default async function ({ get, assert }) {
  const { data } = await get('tools')
  assert(Array.isArray(data), 'returns array')
  assert(data.length === 23, `23 tools (got ${data.length})`)
  assert(!data.find(t => t.name === 'narrate'), 'narrate tool removed')
  assert(data.find(t => t.name === TOOLS.GET), 'get present')
  assert(data.find(t => t.name === TOOLS.LOOK_AROUND), 'look_around present')
  assert(data.every(t => t.enabled === true), 'all tools enabled by default')
  assert(data.every(t => Object.values(ACCESS).includes(t.access)), 'every tool has access')
  assert(data.every(t => Object.values(TOOL_GROUP).includes(t.group)), 'every tool has group')
  assert(data.find(t => t.name === TOOLS.PROJECT_CONFIG).group === TOOL_GROUP.SETTINGS, 'project_config grouped as settings')
}
