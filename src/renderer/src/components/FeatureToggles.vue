<script setup>
import { onMounted, ref, toRaw } from 'vue'

const features = ref({ tts: false })
const saved = ref(false)

onMounted(async () => {
  const cfg = await window.api.config.get()
  if (cfg.features) features.value = { ...features.value, ...cfg.features }
})

async function toggle(key) {
  features.value[key] = !features.value[key]
  await window.api.config.set({ features: { ...toRaw(features.value) } })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}
</script>

<template>
  <div class="features">
    <label class="g-label">Features</label>
    <div class="features_row">
      <span class="features_name">TTS Narration</span>
      <button class="g-btn features_toggle" :class="{ _on: features.tts }" @click="toggle('tts')">
        {{ features.tts ? 'ON' : 'OFF' }}
      </button>
    </div>
    <div v-if="saved" class="g-saved">Saved — restart MCP to apply</div>
    <div class="g-hint">Optional features. Changes require MCP restart.</div>
  </div>
</template>

<style scoped lang="scss">
.features {
  &_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }
  &_name {
    font-size: var(--font-sm);
    color: var(--text);
  }
  &_toggle {
    padding: 4px 14px;
    font-size: var(--font-xs);
    font-weight: 600;
    min-width: 48px;

    &._on {
      background: var(--positive);
      color: var(--text);
      &:hover { background: var(--positive-hover); }
    }
  }
}
</style>
