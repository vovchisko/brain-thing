import { store } from '../modules/store.js'
import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // Simulate a startup failure: forget the prior ready emit, re-emit with an error arg.
  // wrap() should short-circuit with the error text instead of running the handler.
  store.ready.forget()
  store.ready.emit({ error: 'simulated startup failure' })

  const { data } = await post(TOOLS.GET, { name: 'Alpha' })
  assert(data.text.includes('failed to start'), 'wrap returns startup-error response')
  assert(data.text.includes('simulated startup failure'), 'error message included in response')

  // Restore success state so any tests added after this one work normally.
  store.ready.forget()
  store.ready.emit()
}
