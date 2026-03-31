export default async function ({ post, assert }) {
  const { data } = await post('fields', { project: 'TestProject' })
  assert(data.text.includes('project'), 'project field listed')
  assert(data.text.includes('[project: TestProject]'), 'project filter shown')
}
