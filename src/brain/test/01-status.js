export default async function ({ get, assert }) {
  const { status, data } = await get('status')
  assert(status === 200, `status 200 (got ${ status })`)
  assert(data.entries === 3, `3 entries (got ${ data.entries })`)
  assert(typeof data.vault === 'string', 'vault set')
}
