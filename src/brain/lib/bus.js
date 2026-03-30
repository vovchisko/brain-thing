/**
 * Brain event bus.
 *
 * Event: { id, module, text, secondary?, state, lines[] }
 * States: 'pending' | 'ok' | 'warn' | 'error'
 *
 * bus.info/warn/error — single-line, fire-and-forget
 * bus.op — tracked operation with result lines
 */

let nextId = 1
let listener = null

function emit (event) {
  if (listener) listener(event)
}

export function onBrainEvent (fn) {
  listener = fn
}

export function createBus (module, { system = false } = {}) {
  return {
    info  (text, secondary) { emit({ id: nextId++, module, system, text, secondary, state: 'ok', lines: [] }) },
    warn  (text, secondary) { emit({ id: nextId++, module, system, text, secondary, state: 'warn', lines: [] }) },
    error (text, secondary) { emit({ id: nextId++, module, system, text, secondary, state: 'error', lines: [] }); console.error(`[${ module }] ${ text }`) },

    op (text, secondary) {
      const id = nextId++
      const event = { id, module, system, text, secondary, state: 'pending', lines: [] }
      emit(event)

      return {
        update (text, secondary) { event.text = text; if (secondary) event.secondary = secondary; emit(event) },
        ok (...lines)   { event.lines = lines; event.state = 'ok'; emit(event) },
        warn (...lines) { event.lines = lines; event.state = 'warn'; emit(event) },
        fail (...lines) { event.lines = lines; event.state = 'error'; emit(event) },
      }
    },
  }
}
