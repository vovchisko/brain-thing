<script setup>
import { computed, onMounted, ref } from 'vue'

const name = ref('')
const current = ref('')
const saved = ref(false)
const dirty = computed(() => name.value !== current.value)

onMounted(async () => {
  const cfg = await window.api.config.get()
  const val = cfg.guidelineName || 'HOME'
  name.value = val
  current.value = val
})

async function apply() {
  const val = name.value.trim()
  if (!val) return
  await window.api.config.set({ guidelineName: val })
  current.value = val
  saved.value = true
  window.api.brainSwap()
  setTimeout(() => (saved.value = false), 1500)
}
</script>

<template>
  <div class="guideline">
    <label class="g-label">Guideline document</label>
    <div class="guideline_row">
      <input v-model="name" class="g-input guideline_input" placeholder="HOME" spellcheck="false" />
      <button v-if="dirty" class="g-btn _primary" @click="apply">Apply</button>
    </div>
    <div v-if="saved" class="g-saved">Saved</div>
    <div class="g-hint">Entry included in every look_around. Create {{ name || 'HOME' }}.md in your vault.</div>
  </div>
</template>

<style scoped lang="scss">
.guideline {
  &_row {
    display: flex;
    gap: var(--gap-sm);
  }
  &_input { flex: 1; }
}
</style>
