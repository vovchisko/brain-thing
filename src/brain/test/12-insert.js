export default async function ({ post, assert }) {
  const { data } = await post('insert', { name: 'Alpha', text: '\nAppended line', position: 'end' })
  assert(data.text.includes('Inserted'), 'insert confirmed')

  const { data: check } = await post('get', { name: 'Alpha' })
  assert(check.text.includes('Appended line'), 'text appended')
}
