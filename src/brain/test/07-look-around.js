export default async function ({ post, assert }) {
  const { data } = await post('look_around', {})
  assert(data.text.includes('TestProject'), 'shows TestProject')
  assert(data.text.includes('project:'), 'project filter hint')
}
