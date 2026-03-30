<script setup>
import { ref, toRaw, onMounted } from 'vue'
import UiListEditor       from '../ui/UiListEditor.vue'

const folders = ref([])
const patterns = ref([])
const saved = ref(false)

onMounted(async () => {
  const cfg = await window.api.config.get()
  if (cfg.ignore?.folders) folders.value = [...cfg.ignore.folders]
  if (cfg.ignore?.patterns) patterns.value = [...cfg.ignore.patterns]
})

async function save() {
  await window.api.config.set({ ignore: { folders: [...toRaw(folders.value)], patterns: [...toRaw(patterns.value)] } })
  saved.value = true
  window.api.brainSwap()
  setTimeout(() => (saved.value = false), 1500)
}
</script>

<template>
  <div class="ignore">
    <label class="g-label">Ignore</label>
    <p class="ignore_desc">Hide content from MCP and indexing.</p>

    <div class="ignore_section">
      <span class="ignore_sub">Folders — skip if name appears in path</span>
      <UiListEditor v-model="folders" placeholder="Folder name..." @update:model-value="save" />
    </div>

    <div class="ignore_section">
      <span class="ignore_sub">File patterns — skip if filename contains</span>
      <UiListEditor v-model="patterns" placeholder="Substring..." @update:model-value="save" />
    </div>

    <div v-if="saved" class="g-saved">Saved</div>
    <div class="g-hint">Dotfiles and dotfolders are always ignored.</div>
  </div>
</template>

<style scoped lang="scss">
.ignore {
  width: 100%;

  &_desc {
    font-size: var(--font-xs);
    color: var(--text-dim);
    margin-bottom: var(--gap-sm);
  }
  &_section { margin-bottom: var(--gap-sm); }
  &_sub {
    display: block;
    font-size: var(--font-xs);
    color: var(--text-soft);
    margin-bottom: var(--gap-xs);
  }
}
</style>
