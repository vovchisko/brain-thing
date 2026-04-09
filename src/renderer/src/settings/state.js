import { ref } from 'vue'

const config = ref(null)

async function load () {
  config.value = await window.api.config.get()
}

async function save (patch) {
  await window.api.config.set(patch)
  await load()
}

async function saveAndSwap (patch) {
  await save(patch)
  window.api.brainSwap()
}

window.api.config.onChanged(load)

export const settings = { config, load, save, saveAndSwap }
