export default async function ({ post, assert }) {
  const { data } = await post('replace', { name: 'Beta', old_string: 'keyword findme', new_string: 'keyword replaced' })
  assert(data.text.includes('Replaced'), 'replace confirmed')

  const { data: check } = await post('get', { name: 'Beta' })
  assert(check.text.includes('keyword replaced'), 'content replaced')
}
