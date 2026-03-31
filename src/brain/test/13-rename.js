export default async function ({ post, assert }) {
  const { data } = await post('rename', { name: 'Gamma', new_name: 'Gamma Renamed' })
  assert(data.text.includes('Renamed'), 'rename confirmed')

  const { data: check } = await post('get', { name: 'Gamma Renamed' })
  assert(check.text.includes('Gamma'), 'accessible by new name')

  const { data: old } = await post('get', { name: 'Gamma' })
  assert(old.text.includes('not found'), 'old name gone')
}
