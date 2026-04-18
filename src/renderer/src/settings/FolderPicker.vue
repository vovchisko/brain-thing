<script setup>
import { computed, ref, watch } from 'vue'
import { settings } from './state.js'

const folder = ref('')
const current = ref('')
const error = ref('')
const saved = ref(false)
const moving = ref(false)
const oldHasFiles = ref(false)

const dirty = computed(() => folder.value && folder.value !== current.value)
const hasCurrentVault = computed(() => !!current.value)

watch(() => settings.system.value?.vaultPath, (v) => {
  if (v) { folder.value = v; current.value = v }
}, { immediate: true })

async function browse () {
  const picked = await window.api.pickFolder()
  if (picked) {
    folder.value = picked
    error.value = ''
    saved.value = false
    await checkOldVault()
  }
}

function onInput () {
  error.value = ''
  saved.value = false
}

async function checkOldVault () {
  if (!current.value) { oldHasFiles.value = false; return }
  oldHasFiles.value = !(await window.api.isEmpty(current.value))
}

async function apply () {
  if (!folder.value) return
  error.value = ''
  const isDir = await window.api.isDirectory(folder.value)
  if (!isDir) { error.value = 'Folder does not exist'; return }
  await applyFolder(folder.value)
}

async function move () {
  if (!folder.value || !current.value) return
  error.value = ''
  const isDir = await window.api.isDirectory(folder.value)
  if (!isDir) { error.value = 'Folder does not exist'; return }

  moving.value = true
  try {
    await window.api.moveVault(current.value, folder.value)
    await applyFolder(folder.value)
  } catch (e) { error.value = 'Move failed: ' + e.message }
  moving.value = false
}

async function applyFolder (path) {
  await settings.saveSystemAndSwap({ vaultPath: path })
  oldHasFiles.value = false
  saved.value = true
  error.value = ''
  setTimeout(() => (saved.value = false), 1500)
}

function cancel () {
  folder.value = current.value
  error.value = ''
  saved.value = false
  oldHasFiles.value = false
}
</script>

<template>
  <div class="folder-picker">
    <label class="g-label">Vault folder</label>
    <div class="folder-picker_row">
      <input v-model="folder" class="g-input folder-picker_input" placeholder="No folder selected" spellcheck="false" @input="onInput" />

      <template v-if="!hasCurrentVault && !dirty">
        <button class="g-btn" @click="browse">Select</button>
      </template>

      <template v-else-if="!dirty">
        <button class="g-btn" @click="browse">Change</button>
      </template>

      <template v-else>
        <button class="g-btn" @click="cancel">Cancel</button>
        <button class="g-btn _primary" @click="apply">Switch</button>
        <button v-if="oldHasFiles" class="g-btn _warn" :disabled="moving" @click="move">
          {{ moving ? 'Moving...' : 'Move' }}
        </button>
      </template>
    </div>
    <div v-if="error" class="g-error">{{ error }}</div>
    <div v-else-if="saved" class="g-saved">Saved</div>
    <div class="g-hint">Where your notes and documents are stored. Can be an existing Obsidian vault.</div>
  </div>
</template>

<style scoped lang="scss">
.folder-picker {
  &_row {
    display: flex;
    gap: var(--gap-sm);
  }
  &_input { flex: 1; }
}
</style>
