import { ref } from 'vue'

const system = ref(null)
const vault = ref(null)

async function loadSystem () { system.value = await window.api.config.system.get() }
async function loadVault  () { vault.value  = await window.api.config.vault.get() }

async function load () {
  await Promise.all([loadSystem(), loadVault()])
}

async function saveSystem (patch) {
  await window.api.config.system.set(patch)
  await loadSystem()
}

async function saveSystemAndSwap (patch) {
  await saveSystem(patch)
  window.api.brainSwap()
}

async function saveVault (patch) {
  await window.api.config.vault.set(patch)
  await loadVault()
}

async function saveVaultAndSwap (patch) {
  await saveVault(patch)
  window.api.brainSwap()
}

window.api.config.system.onChanged(loadSystem)
window.api.config.vault.onChanged(loadVault)

export const settings = { system, vault, load, saveSystem, saveSystemAndSwap, saveVault, saveVaultAndSwap }
