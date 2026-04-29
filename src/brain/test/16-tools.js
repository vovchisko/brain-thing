export default async function ({ get, assert }) {
  const { data } = await get('tools')
  assert(Array.isArray(data), 'returns array')
  assert(data.length === 16, `16 tools (got ${data.length})`)
  assert(!data.find(t => t.name === 'narrate'), 'narrate tool removed')
  assert(data.find(t => t.name === 'get'), 'get present')
  assert(data.find(t => t.name === 'look_around'), 'look_around present')
}
