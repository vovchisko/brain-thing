export default async function ({ post, assert }) {
  const { data } = await post('delete', { name: 'Gamma Renamed' })
  assert(data.text.includes('Deleted'), 'delete confirmed')

  const { data: check } = await post('get', { name: 'Gamma Renamed' })
  assert(check.text.includes('not found'), 'entry gone')
}
