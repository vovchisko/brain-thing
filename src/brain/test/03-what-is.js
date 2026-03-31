export default async function ({ post, assert }) {
  const { data } = await post('what_is', { query: 'first test' })
  assert(data.text.includes('Alpha'), 'semantic match Alpha')

  const { data: proj } = await post('what_is', { query: 'test', project: 'TestProject' })
  assert(!proj.text.includes('Gamma'), 'Gamma excluded by project')
}
