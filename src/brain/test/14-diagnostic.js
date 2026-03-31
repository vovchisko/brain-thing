export default async function ({ post, assert }) {
  const { data } = await post('diagnostic', {})
  assert(typeof data.text === 'string', 'returns text')

  const { data: proj } = await post('diagnostic', { project: 'TestProject' })
  assert(typeof proj.text === 'string', 'project filter works')
}
