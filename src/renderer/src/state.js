import { reactive, ref } from 'vue'
import { STATUS }                    from '../../shared/status.js'
import { LOG_BUFFER_SIZE }           from '../../shared/constants.js'

export const state = reactive({
  status: { phase: STATUS.IDLE },
  entries: 0,
  issues: { summary: 0, links: 0 },
  fields: {},
  projects: { projects: {}, noProject: 0 },
  verboseConsole: false,
})

// Logs: ordered array, events with same id get updated in place
const logMap = new Map()
const logOrder = []
export const logs = ref([])

function pushLog (event) {
  if (logMap.has(event.id)) {
    const existing = logMap.get(event.id)
    Object.assign(existing, event)
  } else {
    const entry = { ...event }
    logMap.set(event.id, entry)
    logOrder.push(entry)
    if (logOrder.length > LOG_BUFFER_SIZE) {
      const removed = logOrder.shift()
      logMap.delete(removed.id)
    }
  }
  // Trigger reactivity
  logs.value = [...logOrder]
}

let initialized = false

export async function initState () {
  if (initialized) return
  initialized = true

  const cached = await window.api.stats.get()
  Object.assign(state, cached)

  const cfg = await window.api.config.system.get()
  state.verboseConsole = cfg.verboseConsole || false

  const buffer = await window.api.logs.buffer()
  for (const entry of buffer) pushLog(entry)

  window.api.stats.onStatus((d) => state.status = d)
  window.api.stats.onEntries((d) => state.entries = d)
  window.api.stats.onIssues((d) => state.issues = d)
  window.api.stats.onFields((d) => state.fields = d)
  window.api.stats.onProjects((d) => state.projects = d)

  window.api.logs.onPush(pushLog)
}
