import { createBus } from './bus.js'
import { store }    from '../modules/store.js'

const bus = createBus('api', { system: true })

export class ApiError extends Error {
  constructor (code, message) {
    super(message)
    this.code = code
  }
}

export function wrap (name, handler) {
  return async (request) => {
    try {
      await store.ready.wait()
      return await handler(request.body)
    } catch (err) {
      if (err instanceof ApiError) {
        bus.warn(name, err.message.split('\n')[0])
        return { text: err.message }
      }
      bus.error(name, err.message)
      return {
        text: `CRITICAL ERROR: "${ err.message }"\n\nThis is an unexpected system error. Please STOP and inform the user about this error. Do not retry the operation.`,
      }
    }
  }
}
