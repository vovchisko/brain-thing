import { reactive } from 'vue'
import { Logger }   from '@/common/logger.js'

const dev = new Logger({ prefix: 'alert', bg: 'orange', text: 'white' })

const state = reactive({ alerts: [] })

let idCounter = 0

/**
 * Show an alert. Accepts either a config object, a string, or a thrown wse error.
 * @param {Error|Object|string} errorOrConfig
 */
function alert (errorOrConfig) {
  const id = ++idCounter
  let config = errorOrConfig

  if (errorOrConfig?.details?.code) {
    config = {
      class: 'ui-negative',
      message: `${ errorOrConfig.details.code }: ${ errorOrConfig.details.text || errorOrConfig.message || '' }`,
      isError: true,
    }
  } else if (errorOrConfig?.details?.origin?.message) {
    config = {
      class: 'ui-negative',
      message: errorOrConfig.details.origin.message,
      isError: true,
    }
  } else if (errorOrConfig?.code) {
    // ErrorGeneric from the dataset IPC transport: { code, text }
    config = {
      class: 'ui-negative',
      message: `${ errorOrConfig.code }: ${ errorOrConfig.text || errorOrConfig.message || '' }`,
      isError: true,
    }
  } else if (typeof errorOrConfig === 'string') {
    config = { message: errorOrConfig, isError: true }
  }

  const alertModal = {
    id,
    class: config.class || '',
    message: config.message || '',
    title: config.title || '',
    actions: config.actions || [],
    isError: !!config.isError,
    isConfirm: !!config.isConfirm,
    deleteButtonLabel: config.deleteButtonLabel || null,
    resolve: config.resolve || null,
  }

  state.alerts.push(alertModal)
  dev.log('Alert created:', alertModal.title || alertModal.message.slice(0, 60))
  return id
}

/**
 * @param {string} message
 * @param {string} [deleteButtonLabel]
 * @returns {Promise<boolean>}
 */
function confirm (message, deleteButtonLabel = 'Delete') {
  return new Promise(resolve => {
    const id = ++idCounter
    state.alerts.push({
      id,
      class: '',
      message,
      title: 'Confirm',
      actions: [],
      isError: false,
      isConfirm: true,
      deleteButtonLabel,
      resolve,
    })
    dev.log('Confirm created')
  })
}

function close (id) {
  const idx = state.alerts.findIndex(a => a.id === id)
  if (idx > -1) state.alerts.splice(idx, 1)
}

export const alerts = { state, alert, confirm, close }
